import { promises as fs } from 'fs';
import { join } from 'path';

export const dynamic = 'force-static';

export default async function GuacamoleHtmlPage() {
  const filePath = join(process.cwd(), 'public', 'index.html');
  const html = await fs.readFile(filePath, 'utf8');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
