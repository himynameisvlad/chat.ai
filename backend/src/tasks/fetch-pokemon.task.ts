import { ITask } from './base.task';
import { ChatService } from '../services/chat.service';
import { pokemonRepository } from '../database/pokemon.repository';

export class FetchPokemonTask implements ITask {
  name = 'fetch-pokemon';
  schedule = '46 14 * * *';

  constructor(private chatService: ChatService) {}

  async execute(): Promise<void> {
    console.log('🔍 Running fetch Pokemon task');
    try {
      const answer = await this.chatService.getResponse(
        'Получи список 3 слуачайных покемонов. Offset указывай в диапазоне от 0 до 10. Исключи остальную информацию'
      );
      const parsedJson = await this.chatService.getResponse('Верни валидный JSON одной строкой из предоставленной строки. Исключи остальную информацию и пояснения: ' + answer);
      console.log('📦 Pokemon JSON received:', parsedJson);

      await pokemonRepository.savePokemonData(parsedJson);
      console.log('💾 Pokemon data saved to database');
    } catch (error) {
      console.error('Failed to execute fetch Pokemon task:', error);
      throw error;
    }
  }
}
