// Scripted teacher speech for reliable stage demos (judges can also speak live).
import type { ReelLanguageId } from "./types";

export interface DemoLine { text: string; pauseAfterMs: number }

export const DEMO_SCRIPTS: Record<string, { label: string; lines: DemoLine[]; language?: ReelLanguageId; year?: number }> = {
  pecahan: {
    label: "Matematik Tahun 5 — Mendarab pecahan (DSKP 2.1.1)",
    language: "ms-formal",
    year: 5,
    lines: [
      { text: "Selamat pagi murid-murid Tahun 5. Sila buka buku teks dan lihat papan putih.", pauseAfterMs: 3500 },
      { text: "Hari ini kita belajar tentang pecahan, iaitu cara mendarab pecahan dengan nombor bulat.", pauseAfterMs: 4000 },
      { text: "Pecahan wajar ialah pecahan yang pengangkanya lebih kecil daripada penyebutnya, contohnya dua per tiga.", pauseAfterMs: 4500 },
      { text: "Untuk mendarab pecahan dengan nombor bulat, kita darabkan pengangka dengan nombor bulat itu, dan penyebut kekal sama.", pauseAfterMs: 4500 },
      { text: "Contohnya, dua per tiga darab sembilan. Dua darab sembilan ialah lapan belas, dan lapan belas bahagi tiga ialah enam.", pauseAfterMs: 5000 },
      { text: "Jadi, dua per tiga daripada sembilan biji epal ialah enam biji epal.", pauseAfterMs: 4500 },
      { text: "Sekarang kita cuba nombor bercampur pula. Satu setengah darab empat ialah enam.", pauseAfterMs: 9000 },
      { text: "Hey assistant, boleh berikan satu contoh harian untuk kelas?", pauseAfterMs: 11000 },
      { text: "Hey assistant, sediakan lima soalan berdasarkan pelajaran ini.", pauseAfterMs: 2000 },
    ],
  },
  pythagoras: {
    label: "Mathematics — Pythagoras' theorem (SRS §11)",
    lines: [
      { text: "Okay class, good morning. Please put your phones away and look at the board.", pauseAfterMs: 3500 },
      { text: "Today we are going to look at a shape you see everywhere — in buildings, in roofs, even in your school bag.", pauseAfterMs: 4000 },
      { text: "Look at this triangle. One of its angles is exactly ninety degrees, so we call it a right-angled triangle.", pauseAfterMs: 4500 },
      { text: "The side opposite the right angle is always the longest side. It has a special name: the hypotenuse.", pauseAfterMs: 4500 },
      { text: "A long time ago, Pythagoras discovered a relationship between the three sides of a right-angled triangle.", pauseAfterMs: 4000 },
      { text: "If we square the two shorter sides and add them, we get the square of the hypotenuse. a squared plus b squared equals c squared.", pauseAfterMs: 5000 },
      { text: "Let's try some numbers. If one side is three and the other is four, three squared is nine and four squared is sixteen.", pauseAfterMs: 4500 },
      { text: "Nine plus sixteen is twenty-five, and the square root of twenty-five is five. So the hypotenuse is five centimetres.", pauseAfterMs: 9000 },
      { text: "Hey assistant, can you give the class another everyday example?", pauseAfterMs: 11000 },
      { text: "Hey assistant, prepare five questions based on this lesson.", pauseAfterMs: 2000 },
    ],
  },
  photosynthesis: {
    label: "Science — Photosynthesis (topic change demo)",
    lines: [
      { text: "Alright everyone, let's switch to our science lesson now. Look outside at the trees.", pauseAfterMs: 3500 },
      { text: "Plants cannot go to the kantin to buy food. So how do plants get their food?", pauseAfterMs: 4000 },
      { text: "Plants make their own food in their leaves, using sunlight. This process is called photosynthesis.", pauseAfterMs: 4500 },
      { text: "The green pigment chlorophyll absorbs the sunlight. Water comes up from the roots and carbon dioxide enters through tiny holes called stomata.", pauseAfterMs: 5000 },
      { text: "Using that energy, the plant makes glucose, and it releases oxygen — the oxygen we breathe.", pauseAfterMs: 9000 },
      { text: "Hey assistant, explain this in simpler language.", pauseAfterMs: 9000 },
    ],
  },
};
