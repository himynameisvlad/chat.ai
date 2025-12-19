import { IMCPServer } from './base.server';
import { FilesystemServer } from './filesystem.server';
import { PokemonServer } from './pokemon.server';

export const mcpServers: IMCPServer[] = [
  new FilesystemServer(),
  new PokemonServer(),
];

export { IMCPServer, BaseMCPServer } from './base.server';
