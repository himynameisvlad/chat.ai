import { ITask } from './base.task';
import { toastService } from '../services/toast.service';
import { ChatService } from '../services/chat.service';
import { pokemonRepository } from '../database/pokemon.repository';

export class DailyToastTask implements ITask {
  name = 'daily-toast';
  schedule = '52 18 * * *';

  constructor(private chatService: ChatService) {}

  async execute(): Promise<void> {
    console.log('⏰ Running daily toast task');
    try {
      const savedData = await pokemonRepository.getLatestPokemonData();
      if (!savedData) {
        throw new Error('Failed to retrieve saved Pokemon data');
      }

      const message = await this.chatService.getResponse(
        `Отобрази только имена из этого списка: ${savedData}.
        ВАЖНО: Отобрази в следующем формате без другой информации и комментариев:
        "Случайные покемоны дня: 1. {Имя покемона 1} 2. {Имя покемона 2} 3. {Имя покемона 3}"`
      );
      console.log('📋 Formatted message:', message);

      await toastService.broadcastToast(message);
    } catch (error) {
      console.error('Failed to execute daily toast task:', error);
      throw error;
    }
  }
}
