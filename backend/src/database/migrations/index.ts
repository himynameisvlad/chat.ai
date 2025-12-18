import { migration as migration001 } from './001_initial_schema';
import { migration as migration002 } from './002_add_indexes';
import { migration as migration003 } from './003_pokemon_data';

export interface Migration {
  name: string;
  up: string;
  down: string;
}

export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
];
