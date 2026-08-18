/**
 * 文件流式输出（公开路由，令牌鉴权）
 *
 * <video>/<audio>/<iframe> 无法携带 Bearer header，故流数据统一走
 * POST /api/files/token 签发短期令牌后经本路由输出，支持 Range 断点续传。
 * 挂载于 /api/files/stream，必须先于 /api/files 鉴权路由注册。
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { getTokenStore, parseRange } from '../services/fileIO';
import { log } from '../utils/logger';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : undefined;
  if (!token) {
    res.status(400).json({ message: '缺少 token 参数' });
    return;
  }
  const fullPath = getTokenStore().consume(token);
  if (!fullPath) {
    res.status(403).json({ message: '令牌无效或已过期' });
    return;
  }
  try {
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      res.status(404).json({ message: '文件不存在' });
      return;
    }
    const stat = fs.statSync(fullPath);
    const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(path.basename(fullPath))}`
    );

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const range = parseRange(rangeHeader, stat.size);
      if (!range) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
        return;
      }
      const [start, end] = range;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', end - start + 1);
      const stream = fs.createReadStream(fullPath, { start, end });
      stream.pipe(res);
      return;
    }

    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(fullPath).pipe(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('ERROR', 'stream', `流式读取失败: ${msg}`);
    if (!res.headersSent) res.status(500).json({ message: '流式读取失败' });
    res.end();
  }
});

export default router;