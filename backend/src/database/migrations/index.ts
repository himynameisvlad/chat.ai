import { migration as migration001 } from './001_initial_schema';
import { migration as migration002 } from './002_add_indexes';

export interface Migration {
  name: string;
  up: string;
  down: string;
}

export const migrations: Migration[] = [
  migration001,
  migration002,
];
