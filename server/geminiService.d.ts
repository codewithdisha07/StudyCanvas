export declare function callGemini(args: any): Promise<any>;
export declare function simulateGroundedAI(args: {
  feature: string;
  prompt?: string;
  context: any;
  options?: any;
}): any;
export declare function composePersonaPrompt(personaPrompt?: string): string;
