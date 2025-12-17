import { db } from './database';
import { DatabaseError } from './errors';

export interface PokemonData {
  id: number;
  data: string;
  created_at: string;
}

export class PokemonRepository {
  async savePokemonData(data: string): Promise<void> {
    try {
      await db.run('INSERT INTO pokemon_data (data) VALUES (?)', data);
    } catch (error) {
      throw new DatabaseError('Failed to save Pokemon data', 'savePokemonData', error as Error);
    }
  }

  async getLatestPokemonData(): Promise<string | undefined> {
    try {
      const result = await db.get<PokemonData>(`
        SELECT data FROM pokemon_data
        ORDER BY created_at DESC
        LIMIT 1
      `);
      return result?.data;
    } catch (error) {
      throw new DatabaseError('Failed to get latest Pokemon data', 'getLatestPokemonData', error as Error);
    }
  }

  async clearAllPokemonData(): Promise<void> {
    try {
      await db.run('DELETE FROM pokemon_data');
    } catch (error) {
      throw new DatabaseError('Failed to clear Pokemon data', 'clearAllPokemonData', error as Error);
    }
  }
}

export const pokemonRepository = new PokemonRepository();
