import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';
import { env } from '../config/env';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const transcribeAudio = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'File audio mancante' });
      return;
    }

    const form = new FormData();
    form.append('audio_file', req.file.buffer, {
      filename: req.file.originalname || 'audio.m4a',
      contentType: req.file.mimetype || 'audio/m4a',
    });

    const whisperRes = await axios.post<{ text: string }>(
      `${env.WHISPER_URL}/asr?encode=true&task=transcribe&language=it&output=json`,
      form,
      { headers: form.getHeaders(), timeout: 60_000 }
    );

    res.json({ text: (whisperRes.data?.text ?? '').trim() });
  } catch (err) {
    next(err);
  }
};
