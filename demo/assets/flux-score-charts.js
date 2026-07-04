/* global d3 */

// Live score visualisations for the playground, following the ONS Charts
// conventions like the dashboard modules: per-breakpoint margins, muted
// gridlines, data labels and accessible summaries in the page markup.

const BAND_COLOURS = {
  green: '#00703c',
  amber: '#f47738',
  red: '#d4351c'
};

const SERIES_PALETTE = ['#206095', '#27a0cc', '#871a5b', '#a8bd3a', '#f66068', '#746cb1'];

function bandColour(score, bands) {
  if (score >= bands.green_min) return BAND_COLOURS.green;
  if (score >= bands.amber_min) return BAND_COLOURS.amber;
  return BAND_COLOURS.red;
}

export function seriesColour(index) {
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

export function createScoreBars({ containerId, dimensions, bands, neutral }) {
  const graphic = d3.select(`#${containerId}`);
  const margin = { top: 10, right: 40, bottom: 30, left: 130 };
  const seriesHeight = 32;
  const height = seriesHeight * dimensions.length;

  function draw(scores) {
    graphic.selectAll('*').remove();

    const containerWidth = parseInt(graphic.style('width'), 10) || 560;
    const chartWidth = containerWidth - margin.left - margin.right;

    const x = d3.scaleLinear().range([0, chartWidth]).domain([0, 100]);
    const y = d3
      .scaleBand()
      .paddingOuter(0.2)
      .paddingInner(0.25)
      .range([0, height])
      .round(true)
      .domain(dimensions.map((d) => d.label));

    const svg = graphic
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    svg
      .append('g')
      .attr('class', 'flux-chart__gridlines')
      .call(d3.axisBottom(x).tickSize(height).tickValues([0, 25, 50, 75, 100]).tickFormat(''))
      .call((g) => g.select('.domain').remove())
      .selectAll('line')
      .attr('stroke', '#d9d9d9');

    svg
      .append('g')
      .attr('class', 'flux-chart__axis')
      .call(d3.axisLeft(y).tickSize(0).tickPadding(10))
      .call((g) => g.select('.domain').remove());

    svg
      .append('g')
      .attr('class', 'flux-chart__axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickValues([0, 25, 50, 75, 100]))
      .call((g) => g.select('.domain').remove());

    svg
      .selectAll('rect.flux-chart__bar')
      .data(dimensions)
      .join('rect')
      .attr('class', 'flux-chart__bar')
      .attr('x', 0)
      .attr('y', (d) => y(d.label))
      .attr('width', (d) => x(scores[d.key] ?? neutral))
      .attr('height', y.bandwidth())
      .attr('fill', (d) => bandColour(scores[d.key] ?? neutral, bands));

    svg
      .append('line')
      .attr('x1', x(neutral))
      .attr('x2', x(neutral))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#0b0c0c')
      .attr('stroke-dasharray', '4,3');

    svg
      .selectAll('text.flux-chart__data-label')
      .data(dimensions)
      .join('text')
      .attr('class', 'flux-chart__data-label')
      .attr('x', (d) => x(scores[d.key] ?? neutral) + 5)
      .attr('y', (d) => y(d.label) + y.bandwidth() / 2)
      .attr('dominant-baseline', 'central')
      .text((d) => Math.round(scores[d.key] ?? neutral));
  }

  return { draw };
}

export function createScoreLines({ containerId, dimensions, neutral, windowSeconds = 60 }) {
  const graphic = d3.select(`#${containerId}`);
  const margin = { top: 48, right: 20, bottom: 30, left: 40 };
  const chartHeight = 240;

  function draw(history, nowMs) {
    graphic.selectAll('*').remove();
    if (history.length === 0) return;

    const containerWidth = parseInt(graphic.style('width'), 10) || 560;
    const chartWidth = containerWidth - margin.left - margin.right;
    const height = chartHeight - margin.top - margin.bottom;

    const x = d3.scaleLinear().range([0, chartWidth]).domain([nowMs - windowSeconds * 1000, nowMs]);
    const y = d3.scaleLinear().range([height, 0]).domain([0, 100]);

    const svg = graphic
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', chartHeight)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    svg
      .append('g')
      .attr('class', 'flux-chart__gridlines')
      .call(d3.axisLeft(y).tickSize(-chartWidth).tickValues([0, 25, 50, 75, 100]).tickFormat(''))
      .call((g) => g.select('.domain').remove())
      .selectAll('line')
      .attr('stroke', '#d9d9d9');

    svg
      .append('g')
      .attr('class', 'flux-chart__axis')
      .call(d3.axisLeft(y).tickValues([0, 50, 100]).tickSize(0).tickPadding(8))
      .call((g) => g.select('.domain').remove());

    svg
      .append('g')
      .attr('class', 'flux-chart__axis')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(6)
          .tickSize(0)
          .tickPadding(10)
          .tickFormat((d) => `${Math.round((d - nowMs) / 1000)}s`)
      )
      .call((g) => g.select('.domain').remove());

    svg
      .append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', y(neutral))
      .attr('y2', y(neutral))
      .attr('stroke', '#0b0c0c')
      .attr('stroke-dasharray', '4,3');

    dimensions.forEach((dimension, index) => {
      svg
        .append('path')
        .datum(history)
        .attr('fill', 'none')
        .attr('stroke', seriesColour(index))
        .attr('stroke-width', 2.5)
        .attr(
          'd',
          d3
            .line()
            .defined((d) => d.at >= nowMs - windowSeconds * 1000)
            .x((d) => x(d.at))
            .y((d) => y(d.scores[dimension.key] ?? neutral))
        );
    });

    const legend = svg.append('g').attr('transform', `translate(0,${-margin.top + 12})`);
    let offsetX = 0;
    let offsetY = 0;
    dimensions.forEach((dimension, index) => {
      const itemWidth = 14 + dimension.label.length * 7 + 16;
      if (offsetX > 0 && offsetX + itemWidth > chartWidth) {
        offsetX = 0;
        offsetY += 16;
      }
      const item = legend.append('g').attr('transform', `translate(${offsetX},${offsetY})`);
      item.append('rect').attr('width', 10).attr('height', 10).attr('y', -8).attr('fill', seriesColour(index));
      item
        .append('text')
        .attr('class', 'flux-chart__data-label')
        .attr('x', 14)
        .text(dimension.label);
      offsetX += itemWidth;
    });
  }

  return { draw };
}
