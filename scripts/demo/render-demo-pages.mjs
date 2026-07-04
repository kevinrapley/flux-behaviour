import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import nunjucks from 'nunjucks';

import { dashboardChartData, helpRequests } from '../../demo/data/dashboard-fixture.mjs';

const scoringReference = JSON.parse(
  readFileSync(resolve(process.cwd(), 'config/scoring/flux-scoring-config.v6.10.reference.json'), 'utf8')
);

const playgroundDimensionKeys = ['eff', 'nav', 'prof', 'eng', 'frustration', 'cogload'];
const playgroundConfig = {
  dimensions: scoringReference.dimensions
    .filter((dimension) => playgroundDimensionKeys.includes(dimension.key))
    .map(({ key, label }) => ({ key, label })),
  params: scoringReference.engine_reference,
  bands: scoringReference.ui_score_bands
};

const root = resolve(process.cwd());
const outputRoot = resolve(root, process.argv[2] ?? 'public');
const collectorEndpoint = process.env.FLUX_DEMO_COLLECTOR_ENDPOINT ?? 'http://127.0.0.1:8787/collect';

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(resolve(root, 'demo/templates')),
  {
    autoescape: true,
    throwOnUndefined: false
  }
);

const pages = [
  {
    template: 'pages/index.njk',
    output: 'index.html',
    context: {
      pageTitle: 'Get started',
      activeNavigation: 'home'
    }
  },
  {
    template: 'pages/journey.njk',
    output: 'journey/index.html',
    context: {
      pageTitle: 'Apply for a demo licence',
      activeNavigation: 'journey',
      collectorEndpoint
    }
  },
  {
    template: 'pages/playground.njk',
    output: 'playground/index.html',
    context: {
      pageTitle: 'Behavioural dimensions playground',
      activeNavigation: 'playground',
      collectorEndpoint,
      playgroundJson: JSON.stringify(playgroundConfig)
    }
  },
  {
    template: 'pages/dashboard.njk',
    output: 'dashboard/index.html',
    context: {
      pageTitle: 'Behavioural signals dashboard',
      activeNavigation: 'dashboard',
      helpRequests,
      dashboardJson: JSON.stringify(dashboardChartData)
    }
  }
];

for (const page of pages) {
  const html = env.render(page.template, page.context);
  const target = resolve(outputRoot, page.output);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

console.log(`Rendered ${pages.length} demo pages to ${outputRoot}`);
