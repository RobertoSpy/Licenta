import { suggestRoomProgram } from './src/services/ai/agentOrchestrator';

async function main() {
  try {
    const input = {
      targetArea: 120,
      familySize: 3,
      houseStyle: 'modern',
      floors: 1,
      screen: 'screen1'
    };
    const result = await suggestRoomProgram(input as any);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
