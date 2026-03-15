export type AnalysisVerdict = 'Works great' | 'Works okay' | "Doesn't work";

export type MockAnalysisResponse = {
  verdict: AnalysisVerdict;
  stylistNotes: string[];
  suggestedChanges: string[];
};

export const candidatePieceMockAnalyses: MockAnalysisResponse[] = [
  {
    verdict: 'Works great',
    stylistNotes: [
      'The piece has enough structure to complement a sharper wardrobe.',
      'Its color temperature sits well with dark neutrals and olive outerwear.',
    ],
    suggestedChanges: [
      'Keep the rest of the outfit restrained so this piece stays intentional.',
      'Pair it with darker trousers to sharpen the contrast.',
    ],
  },
  {
    verdict: 'Works okay',
    stylistNotes: [
      'The silhouette is usable, but the proportions need more control around the hem and sleeve.',
      'It feels more casual than premium, so the rest of the outfit has to carry polish.',
    ],
    suggestedChanges: [
      'Swap in a cleaner shoe to tighten the overall finish.',
      'Use a more fitted base layer so the look does not feel bulky.',
    ],
  },
  {
    verdict: "Doesn't work",
    stylistNotes: [
      'The fabric and shape make the piece read off-theme for the current wardrobe direction.',
      'It weakens the line of the outfit instead of reinforcing it.',
    ],
    suggestedChanges: [
      'Look for a version with cleaner structure and less visual noise.',
      'Move toward a darker or more muted color to improve versatility.',
    ],
  },
];

export const selfieMockAnalyses: MockAnalysisResponse[] = [
  {
    verdict: 'Works great',
    stylistNotes: [
      'The proportions read balanced, with clean vertical lines through the torso and leg.',
      'The look feels composed and camera-ready without appearing over-styled.',
    ],
    suggestedChanges: [
      'Add one textured accessory if you want slightly more depth.',
      'Maintain this trouser break and jacket length in future looks.',
    ],
  },
  {
    verdict: 'Works okay',
    stylistNotes: [
      'The outfit has a good base, but the top half carries slightly more volume than the lower half.',
      'The shoe works, though it does not fully support the level of polish elsewhere.',
    ],
    suggestedChanges: [
      'Trim one layer from the upper body or choose a cleaner knit.',
      'Switch to a sleeker shoe shape for better visual balance.',
    ],
  },
  {
    verdict: "Doesn't work",
    stylistNotes: [
      'The silhouette feels disconnected, with too many competing proportions.',
      'The outfit currently reads improvised rather than intentional.',
    ],
    suggestedChanges: [
      'Reduce bulk in the top layer and simplify the palette.',
      'Choose a stronger trouser shape and a cleaner shoe to rebuild structure.',
    ],
  },
];
