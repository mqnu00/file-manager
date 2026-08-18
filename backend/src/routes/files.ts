import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import * as fileService from '../services/fileService';
import * as fileIO from '../services/fileIO';
import {
  ArchiveLocals,
  RenameRequest,
  DeleteRequest,
  BatchDeleteRequest,
  ZipCancelRequest,
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
 * 读取文件文本（≤8MB；二进制/超限返回 isText:false 与原因）
 * 查看器通用 I/O（由 file-viewer 插件后端上收，供代码/hex 等查看器使用）
 */
router.get(
  '/read',
  asyncHandler((req: Request, res: Response) => {
    const userPath = typeof req.query.path === 'string' ? req.query.path : undefined;
    if (!userPath) throw new AppError('缺少 path 参数', 400);

    const fullPath = safePath(userPath);
    if (!fs.existsSync(fullPath)) throw new AppError('文件不存在', 404);

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) throw new AppError('不能打开文件夹', 400);

    const result = fileIO.readText(fullPath, stat.size);
    const base = { name: path.basename(fullPath), path: userPath, size: stat.size };
    if (!result.isText) {
      return res.json({ ...base, isText: false, reason: result.reason, content: null, encoding: null });
    }
    res.json({ ...base, isText: true, content: result.content, encoding: result.encoding });
  })
);

/**
 * 写回文本（≤8MB）
 */
router.post(
  '/write',
  asyncHandler((req: Request, res: Response) => {
    const { path: userPath, content, encoding } = req.body as {
      path?: unknown;
      content?: unknown;
      encoding?: unknown;
    };
    if (typeof userPath !== 'string' || typeof content !== 'string') {
      throw new AppError('缺少 path 或 content 参数', 400);
    }
    const fullPath = safePath(userPath);
    const buf = Buffer.from(content, encoding === 'base64' ? 'base64' : 'utf8');
    if (buf.length > fileIO.TEXT_LIMIT) throw new AppError('文件内容过大，不允许写回', 400);
    fs.writeFileSync(fullPath, buf);
    log('INFO', 'write', `file-viewer write 成功 ${userPath}`);
    res.json({ success: true });
  })
);

/**
 * 分页读取二进制字节（hex 查看器）
 */
router.get(
  '/bytes',
  asyncHandler((req: Request, res: Response) => {
    const userPath = typeof req.query.path === 'string' ? req.query.path : undefined;
    const offset = Number(req.query.offset ?? 0);
    const length = Number(req.query.length ?? fileIO.BYTES_LIMIT);
    if (!userPath) throw new AppError('缺少 path 参数', 400);
    if (!Number.isInteger(offset) || offset < 0) throw new AppError('offset 非法', 400);
    if (!Number.isInteger(length) || length <= 0 || length > fileIO.BYTES_LIMIT) {
      throw new AppError(`length 非法（1-${fileIO.BYTES_LIMIT}）`, 400);
    }

    const fullPath = safePath(userPath);
    if (!fs.existsSync(fullPath)) throw new AppError('文件不存在', 404);

    const { data, size } = fileIO.readBytesAt(fullPath, offset, length);
    res.json({ offset, length: data.length, size, data: data.toString('base64') });
  })
);

/**
 * 定位写入二进制字节（hex 编辑器保存）
 */
router.post(
  '/write-range',
  asyncHandler((req: Request, res: Response) => {
    const { path: userPath, offset, data } = req.body as {
      path?: unknown;
      offset?: unknown;
      data?: unknown;
    };
    if (typeof userPath !== 'string' || typeof data !== 'string') {
      throw new AppError('缺少 path 或 data 参数', 400);
    }
    if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
      throw new AppError('offset 非法', 400);
    }

    const fullPath = safePath(userPath);
    const buf = Buffer.from(data, 'base64');
    if (buf.length === 0) throw new AppError('data 为空', 400);
    if (buf.length > fileIO.BYTES_LIMIT) throw new AppError('单次写入过大', 400);
    if (!fs.existsSync(fullPath)) throw new AppError('文件不存在', 404);

    fileIO.writeRangeAt(fullPath, offset, buf);
    log('INFO', 'write', `file-viewer write-range 成功 ${userPath} @${offset}+${buf.length}`);
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
