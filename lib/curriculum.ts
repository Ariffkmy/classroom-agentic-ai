// Prototype curriculum knowledge base.
// NOTE: This is a configured *sample* dataset for the competition demo. Codes and wording
// are adapted for demonstration and must be verified against official DSKP documents
// before any production use (FR-04: never invent curriculum references).

import type { CurriculumRef, QuizQuestion, Scene } from "./types";

export interface TopicEntry {
  id: string;
  subject: string;
  topic: string;
  level: string;
  keywords: Record<string, number>; // keyword/phrase -> weight
  concepts: Record<string, string>; // trigger phrase -> concept label
  curriculum: CurriculumRef;
  everydayExamples: string[];
  simpler: string;
  summaryHint: string;
  planTrigger: string; // concept that signals a visual would help
  animation: { title: string; format: "animation" | "storyboard"; brief: string; scenes: Scene[] };
  fallback: { title: string; scenes: Scene[] };
  quiz: QuizQuestion[];
  followUps: Record<string, { title: string; explanation: string; scenes: Scene[] }>;
}

const pythagorasScenes: Scene[] = [
  {
    title: "A ladder against a wall",
    caption: "A painter leans a ladder against a wall. The foot of the ladder is 3 m from the wall.",
    narration: "Imagine a painter leaning a ladder against a wall. The foot of the ladder is three metres from the wall.",
    visual: { kind: "ladder", step: 0 },
    durationMs: 6500,
  },
  {
    title: "Spot the right angle",
    caption: "The wall and the ground meet at 90°. That makes a right-angled triangle.",
    narration: "The wall and the ground meet at ninety degrees. Together with the ladder, they form a right-angled triangle.",
    visual: { kind: "ladder", step: 1 },
    durationMs: 6500,
  },
  {
    title: "The hypotenuse is the ladder",
    caption: "The side opposite the right angle is the longest side — the hypotenuse, c.",
    narration: "The side opposite the right angle is the longest side. Here, that is the ladder. We call it the hypotenuse, c.",
    visual: { kind: "ladder", step: 2 },
    durationMs: 7000,
  },
  {
    title: "Build a square on every side",
    caption: "Square on the ground: 3² = 9.  Square on the wall: 4² = 16.  Square on the ladder: c².",
    narration: "Now build a square on every side. The ground gives three squared, nine. The wall gives four squared, sixteen.",
    formula: "a² + b² = c²",
    visual: { kind: "ladder", step: 3 },
    durationMs: 8000,
  },
  {
    title: "The two small squares fill the big one",
    caption: "9 + 16 = 25, and √25 = 5. The ladder is 5 m long.",
    narration: "Nine plus sixteen is twenty five. The square root of twenty five is five. So the ladder is five metres long.",
    formula: "3² + 4² = 9 + 16 = 25 = 5²",
    visual: { kind: "ladder", step: 4 },
    durationMs: 8000,
  },
  {
    title: "Your turn!",
    caption: "A 10 m ladder stands 6 m from a wall. How high up the wall does it reach?",
    narration: "Your turn. A ten metre ladder stands six metres from the wall. How high up the wall does it reach? Discuss with your group.",
    formula: "6² + h² = 10²  →  h = ?",
    visual: { kind: "ladder", step: 5, a: 6, b: 8 },
    durationMs: 9000,
  },
];

const hypotenuseFollowUp: Scene[] = [
  {
    title: "Find the right angle first",
    caption: "Triangles can be turned any way. Always look for the small square ∟ that marks 90°.",
    narration: "Triangles can be turned any way. Always find the right angle first. Look for the small square marking ninety degrees.",
    visual: { kind: "triangle", rotation: 0, labels: ["P", "Q", "R"], highlight: "right" },
    durationMs: 6500,
  },
  {
    title: "Look straight across from it",
    caption: "The hypotenuse is the side that does NOT touch the right angle.",
    narration: "Now look straight across from the right angle. The hypotenuse is the only side that does not touch it.",
    visual: { kind: "triangle", rotation: 0, labels: ["P", "Q", "R"], highlight: "hyp" },
    durationMs: 6500,
  },
  {
    title: "Turn the triangle — the rule still works",
    caption: "Right angle at Q → the hypotenuse is PR, the side opposite Q.",
    narration: "Even when we turn the triangle, the rule still works. If the right angle is at Q, the hypotenuse is P R.",
    visual: { kind: "triangle", rotation: 140, labels: ["P", "Q", "R"], highlight: "hyp" },
    durationMs: 7000,
  },
  {
    title: "Quick check",
    caption: "Right angle at Y in triangle XYZ. Which side is the hypotenuse? (Answer: XZ)",
    narration: "Quick check. In triangle X Y Z, the right angle is at Y. Which side is the hypotenuse? Show me on your answer cards.",
    visual: { kind: "triangle", rotation: 250, labels: ["X", "Y", "Z"], highlight: "right" },
    durationMs: 8000,
  },
];

const shorterSideFollowUp: Scene[] = [
  {
    title: "Missing a shorter side?",
    caption: "When you know the hypotenuse, subtract instead of add.",
    narration: "When the missing side is a shorter side, we subtract instead of add.",
    formula: "a² = c² − b²",
    visual: { kind: "ladder", step: 2, a: 5, b: 12 },
    durationMs: 7000,
  },
  {
    title: "Worked example",
    caption: "Ladder 13 m, foot 5 m away: h² = 13² − 5² = 169 − 25 = 144, so h = 12 m.",
    narration: "Ladder thirteen metres, foot five metres away. h squared equals one six nine minus twenty five, which is one four four. So h is twelve metres.",
    formula: "h = √(169 − 25) = √144 = 12",
    visual: { kind: "ladder", step: 4, a: 5, b: 12 },
    durationMs: 9000,
  },
];

const photosynthesisScenes: Scene[] = [
  {
    title: "A leaf is a tiny food factory",
    caption: "Plants make their own food in their leaves.",
    narration: "A leaf is like a tiny food factory. Plants make their own food inside their leaves.",
    visual: { kind: "photosynthesis", step: 0 },
    durationMs: 6000,
  },
  {
    title: "Ingredients come in",
    caption: "Sunlight is absorbed by chlorophyll. Water comes up from the roots. Carbon dioxide enters through the stomata.",
    narration: "Three ingredients come in. Sunlight, absorbed by green chlorophyll. Water from the roots. And carbon dioxide from the air.",
    visual: { kind: "photosynthesis", step: 1 },
    durationMs: 8000,
  },
  {
    title: "Products go out",
    caption: "The plant makes glucose for energy and releases oxygen — the oxygen we breathe!",
    narration: "The plant makes glucose for energy, and releases oxygen. That is the oxygen we breathe.",
    formula: "carbon dioxide + water → glucose + oxygen  (light, chlorophyll)",
    visual: { kind: "photosynthesis", step: 2 },
    durationMs: 8000,
  },
  {
    title: "Think about it",
    caption: "Why do plants kept in a dark cupboard turn yellow and weak?",
    narration: "Think about it with your group. Why do plants kept in a dark cupboard turn yellow and weak?",
    visual: { kind: "photosynthesis", step: 3 },
    durationMs: 8000,
  },
];

export const TOPICS: TopicEntry[] = [
  {
    id: "math-pythagoras",
    subject: "Mathematics",
    topic: "Pythagoras' Theorem",
    level: "Form 2 (Lower Secondary)",
    keywords: {
      "right-angled": 3, "right angled": 3, "right angle": 2.5, "ninety degrees": 1.5, "90 degrees": 1.5,
      hypotenuse: 4, pythagoras: 5, pythagorean: 5, triangle: 1.5, "longest side": 2,
      squared: 1.5, "square root": 2, "a squared": 2, "b squared": 2, "c squared": 2, sides: 0.8, ladder: 1,
    },
    concepts: {
      "right angle": "Right-angled triangle",
      "right-angled": "Right-angled triangle",
      "right angled": "Right-angled triangle",
      hypotenuse: "Hypotenuse = side opposite the right angle",
      "longest side": "Hypotenuse is the longest side",
      "squared": "Squares of the sides",
      "a squared plus b squared": "a² + b² = c²",
      "square root": "Finding a length with √",
      "three squared": "Worked example 3-4-5",
    },
    curriculum: {
      curriculum: "KSSM Mathematics",
      subject: "Mathematics",
      level: "Form 2",
      unit: "Chapter 6: Pythagoras' Theorem",
      objectives: [
        { code: "6.1.1", text: "Identify and define the hypotenuse of a right-angled triangle." },
        { code: "6.1.2", text: "Determine the relationship between the sides of a right-angled triangle and explain Pythagoras' theorem." },
        { code: "6.1.3", text: "Determine the length of an unknown side of a right-angled triangle." },
        { code: "6.1.4", text: "Solve problems involving Pythagoras' theorem." },
        { code: "6.2.1", text: "Determine whether a triangle is right-angled using the converse of Pythagoras' theorem." },
      ],
      source: "Prototype curriculum dataset (adapted from KSSM Form 2 DSKP) — sample mapping",
      verified: true,
    },
    everydayExamples: [
      "A TV is measured diagonally. A screen 48 cm wide and 36 cm tall is a 60 cm TV, because 36² + 48² = 60².",
      "Walking diagonally across a rectangular padang is shorter than walking along two sides — the diagonal is the hypotenuse.",
      "A builder checks a corner is square by marking 3 m and 4 m along two walls: if the gap is exactly 5 m, the corner is 90°.",
    ],
    simpler:
      "In a triangle with a square corner, the longest side is special. If you make a square from each of the two short sides, those two squares together are exactly as big as the square on the longest side.",
    summaryHint: "right-angled triangles and the relationship a² + b² = c²",
    planTrigger: "a² + b² = c²",
    animation: {
      title: "The Ladder & the Wall — Pythagoras in real life",
      format: "animation",
      brief:
        "Animated real-world example: a ladder leaning against a wall forms a right-angled triangle. Show the right angle, identify the hypotenuse, build squares on each side (9, 16, 25), derive 3² + 4² = 5², finish with a group challenge (6–8–10). Audience: Form 2. Narrated, ~45 s.",
      scenes: pythagorasScenes,
    },
    fallback: {
      title: "Diagram: squares on the sides of a right-angled triangle",
      scenes: [
        {
          title: "Squares on the sides (static diagram)",
          caption: "3² + 4² = 9 + 16 = 25 = 5². The square on the hypotenuse equals the sum of the other two squares.",
          narration: "Here is a simple diagram. The square on the hypotenuse equals the sum of the squares on the other two sides.",
          formula: "a² + b² = c²",
          visual: { kind: "ladder", step: 4 },
          durationMs: 12000,
        },
      ],
    },
    quiz: [
      {
        id: "q1", prompt: "Which side of a right-angled triangle is the hypotenuse?",
        options: ["The shortest side", "The side opposite the right angle", "The side next to the right angle", "Any side"],
        answer: 1, concept: "hypotenuse", objective: "6.1.1",
        explanation: "The hypotenuse is opposite the right angle and is always the longest side.",
      },
      {
        id: "q2", prompt: "The two shorter sides of a right-angled triangle are 6 cm and 8 cm. How long is the hypotenuse?",
        options: ["10 cm", "14 cm", "12 cm", "48 cm"],
        answer: 0, concept: "find-hypotenuse", objective: "6.1.3",
        explanation: "6² + 8² = 36 + 64 = 100, and √100 = 10 cm.",
      },
      {
        id: "q3", prompt: "In triangle PQR, the right angle is at Q. Which side is the hypotenuse?",
        options: ["PQ", "QR", "PR", "Cannot be determined"],
        answer: 2, concept: "hypotenuse", objective: "6.1.1",
        explanation: "The hypotenuse is opposite the right angle at Q, so it is PR.",
      },
      {
        id: "q4", prompt: "A 13 m ladder leans on a wall. Its foot is 5 m from the wall. How high does it reach?",
        options: ["8 m", "18 m", "12 m", "√194 m"],
        answer: 2, concept: "find-shorter-side", objective: "6.1.4",
        explanation: "h² = 13² − 5² = 169 − 25 = 144, so h = 12 m.",
      },
      {
        id: "q5", prompt: "Is a triangle with sides 7 cm, 24 cm and 25 cm a right-angled triangle?",
        options: ["Yes, because 7² + 24² = 25²", "No, because 7 + 24 ≠ 25", "Yes, because 25 is the biggest", "Not enough information"],
        answer: 0, concept: "converse", objective: "6.2.1",
        explanation: "49 + 576 = 625 = 25², so by the converse of Pythagoras' theorem it is right-angled.",
      },
    ],
    followUps: {
      hypotenuse: {
        title: "Spot the Hypotenuse — even when the triangle turns",
        explanation:
          "Many groups chose a side touching the right angle. Re-teach: find the right-angle marker first, then the hypotenuse is the side directly opposite it — no matter how the triangle is rotated.",
        scenes: hypotenuseFollowUp,
      },
      "find-shorter-side": {
        title: "Finding a shorter side: subtract, don't add",
        explanation:
          "Groups added the squares when the hypotenuse was already known. Re-teach with a worked ladder example: a² = c² − b².",
        scenes: shorterSideFollowUp,
      },
    },
  },
  {
    id: "sci-photosynthesis",
    subject: "Science",
    topic: "Photosynthesis",
    level: "Lower Secondary",
    keywords: {
      photosynthesis: 5, chlorophyll: 4, stomata: 3, glucose: 2.5, "carbon dioxide": 2.5, oxygen: 1.5,
      leaf: 1.5, leaves: 1.5, sunlight: 2, plant: 1.2, plants: 1.2, "make their own food": 3, roots: 1,
    },
    concepts: {
      chlorophyll: "Chlorophyll absorbs light",
      sunlight: "Light energy is required",
      "carbon dioxide": "Carbon dioxide is a raw material",
      water: "Water is a raw material",
      glucose: "Glucose is produced",
      oxygen: "Oxygen is released",
      stomata: "Gas exchange through stomata",
    },
    curriculum: {
      curriculum: "KSSM Science",
      subject: "Science",
      level: "Lower Secondary",
      unit: "Plants: Photosynthesis",
      objectives: [
        { code: "PS-1", text: "State the raw materials and products of photosynthesis." },
        { code: "PS-2", text: "Explain the role of light and chlorophyll in photosynthesis." },
        { code: "PS-3", text: "Relate photosynthesis to the oxygen supply for living things." },
      ],
      source: "Prototype curriculum dataset — sample mapping (unit code not verified)",
      verified: false,
    },
    everydayExamples: [
      "Grass under a mat left on the field for a week turns yellow — no light, no photosynthesis.",
      "Aquarium plants release tiny bubbles in bright light — those bubbles are oxygen.",
    ],
    simpler: "Plants are like cooks. They use sunlight as the stove, and water and air as ingredients, to cook sugar for food — and they give out oxygen for us.",
    summaryHint: "how plants use light, water and carbon dioxide to make glucose and oxygen",
    planTrigger: "Chlorophyll absorbs light",
    animation: {
      title: "The Leaf Food Factory",
      format: "animation",
      brief: "Animated diagram of a leaf as a factory: inputs (light, water, CO₂) and outputs (glucose, O₂). Lower secondary. ~30 s.",
      scenes: photosynthesisScenes,
    },
    fallback: {
      title: "Diagram: inputs and outputs of photosynthesis",
      scenes: [{ ...photosynthesisScenes[2], durationMs: 12000 }],
    },
    quiz: [
      { id: "q1", prompt: "Which gas do plants take in for photosynthesis?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2, concept: "raw-materials", objective: "PS-1", explanation: "Carbon dioxide enters through the stomata." },
      { id: "q2", prompt: "What is the role of chlorophyll?", options: ["Absorbs light energy", "Stores water", "Releases carbon dioxide", "Makes roots grow"], answer: 0, concept: "chlorophyll", objective: "PS-2", explanation: "Chlorophyll absorbs light energy." },
      { id: "q3", prompt: "Which is a product of photosynthesis?", options: ["Water", "Glucose", "Carbon dioxide", "Soil"], answer: 1, concept: "products", objective: "PS-1", explanation: "Glucose and oxygen are produced." },
      { id: "q4", prompt: "Why does a plant in a dark cupboard become weak?", options: ["Too much oxygen", "It cannot photosynthesise", "It gets too much water", "Its roots grow too fast"], answer: 1, concept: "light", objective: "PS-2", explanation: "Without light it cannot make food." },
    ],
    followUps: {
      "raw-materials": {
        title: "Ingredients vs products",
        explanation: "Groups mixed up what goes in and what comes out. Use a sorting activity: inputs vs outputs.",
        scenes: photosynthesisScenes.slice(1, 3),
      },
    },
  },
  {
    id: "math-fractions",
    subject: "Mathematics",
    topic: "Fractions",
    level: "Primary Year 4",
    keywords: { fraction: 4, fractions: 4, numerator: 4, denominator: 4, "equivalent": 2, half: 1, quarter: 1.5, "out of": 0.5 },
    concepts: { numerator: "Numerator = parts taken", denominator: "Denominator = equal parts", equivalent: "Equivalent fractions" },
    curriculum: {
      curriculum: "KSSR Mathematics", subject: "Mathematics", level: "Year 4", unit: "Fractions",
      objectives: [
        { code: "FR-1", text: "Name and write proper fractions." },
        { code: "FR-2", text: "Determine equivalent fractions." },
      ],
      source: "Prototype curriculum dataset — sample mapping (unit code not verified)",
      verified: false,
    },
    everydayExamples: ["Cutting a roti canai into 4 equal pieces and eating 1 means you ate ¼."],
    simpler: "A fraction tells how many equal pieces you have out of the whole.",
    summaryHint: "parts of a whole",
    planTrigger: "Denominator = equal parts",
    animation: {
      title: "Sharing a Pizza", format: "storyboard", brief: "Storyboard showing a pizza shared into equal parts.",
      scenes: [
        { title: "One whole pizza", caption: "Cut into 8 equal slices.", narration: "One whole pizza, cut into eight equal slices.", visual: { kind: "emoji", emoji: ["🍕"] }, durationMs: 5000 },
        { title: "Take 3 slices", caption: "3 out of 8 slices is 3/8.", narration: "Take three slices. Three out of eight is three eighths.", formula: "3/8", visual: { kind: "emoji", emoji: ["🍕", "🍕", "🍕"] }, durationMs: 6000 },
      ],
    },
    fallback: { title: "Fraction bar", scenes: [{ title: "Fraction bar", caption: "numerator / denominator", narration: "Numerator over denominator.", visual: { kind: "emoji", emoji: ["▭"] }, durationMs: 8000 }] },
    quiz: [
      { id: "q1", prompt: "In 3/8, what is the denominator?", options: ["3", "8", "11", "5"], answer: 1, concept: "denominator", explanation: "The bottom number is the denominator." },
      { id: "q2", prompt: "Which fraction equals 1/2?", options: ["2/4", "1/3", "3/4", "2/3"], answer: 0, concept: "equivalent", explanation: "2/4 simplifies to 1/2." },
    ],
    followUps: {},
  },
];

export function getTopic(id: string | null | undefined): TopicEntry | undefined {
  return TOPICS.find((t) => t.id === id);
}
