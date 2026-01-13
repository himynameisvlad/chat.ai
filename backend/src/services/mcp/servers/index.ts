import { IMCPServer } from './base.server';
import { FilesystemServer } from './filesystem.server';
import { PokemonServer } from './pokemon.server';
import { DockerServer } from './docker.server';
import { RAGServer } from './rag.server';
import { GitServer } from './git.server';

export const mcpServers: IMCPServer[] = [
  new FilesystemServer(),
  new PokemonServer(),
  new DockerServer(),
  new RAGServer(),
  new GitServer(),
];

export { IMCPServer, BaseMCPServer } from './base.server';
