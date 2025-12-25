import { IMCPServer } from './base.server';
import { FilesystemServer } from './filesystem.server';
import { PokemonServer } from './pokemon.server';
import { DockerServer } from './docker.server';
import { PDFServer } from './pdf.server';
import { RAGServer } from './rag.server';

export const mcpServers: IMCPServer[] = [
  new FilesystemServer(),
  new PokemonServer(),
  new DockerServer(),
  new PDFServer(),
  new RAGServer(),
];

export { IMCPServer, BaseMCPServer } from './base.server';
