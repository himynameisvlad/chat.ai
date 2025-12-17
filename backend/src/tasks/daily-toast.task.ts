import { ITask } from './base.task';
import { toastService } from '../services/toast.service';
import { ChatService } from '../services/chat.service';
import { pokemonRepository } from '../database/pokemon.repository';

export class DailyToastTask implements ITask {
  name = 'daily-toast';
  schedule = '50 14 * * *';

  constructor(private chatService: ChatService) {}

  async execute(): Promise<void> {
    console.log('⏰ Running daily toast task');
    try {
      const savedData = await pokemonRepository.getLatestPokemonData();
      if (!savedData) {
        throw new Error('Failed to retrieve saved Pokemon data');
      }

      const message = await this.chatService.getResponse(
        `Отобрази только имена из этого списка: ${savedData}. Отобрази в следующем формате: "Случайные покмены дня: 1. {Имя покемона}". Исключи остальную информацию`
      );
      console.log('📋 Formatted message:', message);

      await toastService.broadcastToast(message);
    } catch (error) {
      console.error('Failed to execute daily toast task:', error);
      throw error;
    }
  }
}
