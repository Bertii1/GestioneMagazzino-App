import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import axios from 'axios';
import { env } from '../config/env';

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo immagini sono accettate'));
    }
  },
});

const PROMPT = `Analizza questa immagine di un prodotto elettronico (apparecchio audio, video, cavo, componente, accessorio, ecc.).
Rispondi SOLO con un JSON valido, senza markdown o testo aggiuntivo, con questi campi:
{
  "name": "nome del prodotto (breve, es. 'Sony WH-1000XM5')",
  "brand": "marca/produttore oppure null",
  "model": "modello oppure null",
  "color": "colore principale oppure null",
  "description": "breve descrizione (max 100 caratteri) oppure null",
  "category": "categoria merceologica (es. 'Cuffie', 'Cavo HDMI', 'Amplificatore') oppure null",
  "barcode": "codice a barre se visibile nell'immagine oppure null"
}
Se non riesci a identificare il prodotto, rispondi: {"name": null}`;

export const identifyProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!env.GEMINI_API_KEY) {
      res.status(503).json({ message: 'Riconoscimento visivo non configurato (GEMINI_API_KEY mancante)' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'Immagine mancante' });
      return;
    }

    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [
            { text: PROMPT },
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
        },
      },
      { timeout: 30_000 }
    );

    const text = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Estrai JSON dalla risposta (Gemini a volte wrappa in ```json ... ```)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(422).json({ message: 'Risposta AI non valida', raw: text });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.name) {
      res.status(404).json({ message: 'Prodotto non riconosciuto dalla foto' });
      return;
    }

    res.json(parsed);
  } catch (err) {
    next(err);
  }
};
