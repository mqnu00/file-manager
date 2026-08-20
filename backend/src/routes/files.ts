import express, { Request, Response } from 'express';
import fs from 'fs';
import * as fileService from '../services/fileService';
import * as fileIO from '../services/fileIO';
import {
  ArchiveLocals,
  RenameRequest,
  DeleteRequest,
  BatchDeleteRequest,
  ZipCancelRequest,
  CreateFileRequest,
} from '../types';
import { asyncHandler } from '../middleware/asyncHandler';
import { safePath, calculateDirSize } from '../utils/safePath';
import { AppError } from '../utils/AppError';
import { log } from '../utils/logger';

const router = express.Router();

/**
 * 获取文件列表
 */
router.get(
  '/',
  asyncHandler((req: Request, res: Response) => {
    const { path } = req.query;
    const queryPath = typeof path === 'string' ? path : undefined;
    const result = fileService.getFileList(queryPath);
    res.json(result);
  })
);

/**
 * 压缩文件夹（使用 SSE 发送进度）
 */
router.post('/zip', async (req: Request, res: Response) => {
  const folderPath = req.body.path as string
  try {
    if (!folderPath) {
      return res.status(400).json({ message: '缺少文件夹路径' });
    }

    const activeArchives = (req.app.locals as ArchiveLocals).activeArchives || {};
    if (!(req.app.locals as ArchiveLocals).activeArchives) {
      (req.app.locals as ArchiveLocals).activeArchives = activeArchives;
    }

    await fileService.zipFolder(folderPath, res, activeArchives);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : '未知错误'
    log('ERROR', 'other', `压缩失败 ${folderPath}: ${errMsg}`)
    res.status(500).json({ message: errMsg })
  }
});

/**
 * 取消压缩任务
 */
router.post(
  '/zip/cancel',
  asyncHandler((req: Request, res: Response) => {
    const { path: folderPath } = req.body as ZipCancelRequest;

    if (!folderPath) {
      return res.status(400).json({ message: '缺少文件夹路径' });
    }

    const archiveLocals = req.app.locals as ArchiveLocals;
    if (!archiveLocals.activeArchives) {
      archiveLocals.activeArchives = {};
    }

    const success = fileService.cancelZip(folderPath, archiveLocals.activeArchives);

    if (!success) {
      return res.status(404).json({ message: '未找到正在进行的压缩任务' });
    }

    res.json({ success: true });
  })
);

/**
 * 移动文件（使用 SSE 发送进度）
 */
router.post('/move', (req: Request, res: Response) => {
  const { fromPath, toPath } = req.body;

  try {
    if (!fromPath || !toPath) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    fileService.moveFile(fromPath, toPath, res);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : '移动失败'
    log('ERROR', 'move', `${fromPath} → ${toPath}: ${errMsg}`)
    res.status(500).json({ message: errMsg });
  }
});

/**
 * 计算文件夹大小
 */
router.get(
  '/dirsize',
  asyncHandler(async (req: Request, res: Response) => {
    const { path: dirPath } = req.query as { path?: string };

    if (!dirPath) {
      return res.status(400).json({ message: '缺少文件夹路径' });
    }

    const fullPath = safePath(dirPath);

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      throw new AppError('文件夹不存在');
    }

    const size = await calculateDirSize(fullPath);
    res.json({ size });
  })
);

/**
 * 读取文件二进制（纯透传，不做文本/二进制判断，应用自行决定内容类型与大小）
 * 省略 offset/length = 整文件读取（截断到 IO_LIMIT，size 返回真实文件大小）；
 * 传 offset/length = 分页读取（hex 查看器）
 */
router.get(
  '/read',
  asyncHandler((req: Request, res: Response) => {
    const userPath = typeof req.query.path === 'string' ? req.query.path : undefined;
    if (!userPath) throw new AppError('缺少 path 参数', 400);

    const fullPath = safePath(userPath);
    if (!fs.existsSync(fullPath)) throw new AppError('文件不存在', 404);
    if (fs.statSync(fullPath).isDirectory()) throw new AppError('不能打开文件夹', 400);
    const size = fs.statSync(fullPath).size;

    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (!Number.isInteger(offset) || offset < 0) throw new AppError('offset 非法', 400);

    let length: number;
    if (req.query.length === undefined) {
      length = Math.min(Math.max(size - offset, 0), fileIO.IO_LIMIT);
    } else {
      length = Number(req.query.length);
      if (!Number.isInteger(length) || length <= 0 || length > fileIO.IO_LIMIT) {
        throw new AppError(`length 非法（1-${fileIO.IO_LIMIT}）`, 400);
      }
    }

    const { data } = fileIO.readBytesAt(fullPath, offset, length);
    res.json({ offset, length: data.length, size, data: data.toString('base64') });
  })
);

/**
 * 写回文件二进制（纯透传）
 * 省略 offset = 整文件覆盖（允许空内容清空文件）；传 offset = 定位写入（hex 编辑器保存）
 */
router.post(
  '/write',
  asyncHandler((req: Request, res: Response) => {
    const { path: userPath, data, offset } = req.body as {
      path?: unknown;
      data?: unknown;
      offset?: unknown;
    };
    if (typeof userPath !== 'string' || typeof data !== 'string') {
      throw new AppError('缺少 path 或 data 参数', 400);
    }
    const buf = Buffer.from(data, 'base64');
    if (buf.length > fileIO.IO_LIMIT) throw new AppError('单次写入过大', 400);

    const fullPath = safePath(userPath);
    if (!fs.existsSync(fullPath)) throw new AppError('文件不存在', 404);
    if (fs.statSync(fullPath).isDirectory()) throw new AppError('不能写入文件夹', 400);

    if (offset === undefined) {
      // 整文件覆盖（允许空内容清空文件）
      fs.writeFileSync(fullPath, buf);
    } else {
      if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
        throw new AppError('offset 非法', 400);
      }
      if (buf.length === 0) throw new AppError('定位写入 data 不能为空', 400);
      fileIO.writeRangeAt(fullPath, offset, buf);
    }
    log('INFO', 'write', `write 成功 ${userPath}${offset === undefined ? '' : ` @${offset}+${buf.length}`}`);
    res.json({ success: true });
  })
);

/**
 * 签发流令牌（绑定绝对路径，30 分钟有效）
 * 供 <video>/<audio>/<iframe> 经 /api/files/stream 使用（无法携带 Bearer header）
 */
router.post(
  '/token',
  asyncHandler((req: Request, res: Response) => {
    const { path: userPath } = req.body as { path?: unknown };
    if (typeof userPath !== 'string') throw new AppError('缺少 path 参数', 400);

    const fullPath = safePath(userPath);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      throw new AppError('文件不存在', 404);
    }
    const token = fileIO.getTokenStore().issue(fullPath);
    res.json({ token, expiresIn: fileIO.STREAM_TTL_MS });
  })
);

/**
 * 下载文件
 *
 * ⚠️ 通配符兜底路由 — 必须保持在所有具体 GET 路由之后
 * 否则 /zip、/move 等路由会被通配符捕获
 */
router.get(
  '/download/*',
  asyncHandler((req: Request, res: Response) => {
    const filePath = req.params[0];
    fileService.downloadFile(filePath, res);
  })
);

/**
 * 重命名文件
 */
router.put(
  '/rename',
  asyncHandler((req: Request, res: Response) => {
    const { path: filePath, newName } = req.body as RenameRequest;

    if (!filePath || !newName) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    fileService.renameFile(filePath, newName);
    res.json({ success: true });
  })
);

/**
 * 批量删除文件/文件夹
 */
router.post(
  '/batch-delete',
  asyncHandler((req: Request, res: Response) => {
    const { paths } = req.body as BatchDeleteRequest;

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ message: '缺少文件路径列表' });
    }

    const result = fileService.deleteFiles(paths);
    res.json(result);
  })
);

/**
 * 创建文件（空文件）
 */
router.post(
  '/',
  asyncHandler((req: Request, res: Response) => {
    const { path: parentPath, name } = req.body as CreateFileRequest;

    if (!name) {
      return res.status(400).json({ message: '缺少文件名称' });
    }

    fileService.createFile(parentPath, name);
    res.json({ success: true });
  })
);

/**
 * 删除文件/文件夹
 */
router.delete(
  '/',
  asyncHandler((req: Request, res: Response) => {
    const { path: filePath } = req.query as unknown as DeleteRequest;

    if (!filePath) {
      return res.status(400).json({ message: '缺少文件路径' });
    }

    fileService.deleteFile(filePath);
    res.json({ success: true });
  })
);

export default router;
