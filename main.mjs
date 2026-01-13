import { VisSingleContainer, Donut } from 'https://cdn.jsdelivr.net/npm/@unovis/ts@1.4.3/+esm'

// Demo data
const data = [
  { id: 'A', label: 'Alpha', value: 30, color: '#4f46e5' },
  { id: 'B', label: 'Beta', value: 22, color: '#06b6d4' },
  { id: 'C', label: 'Gamma', value: 18, color: '#10b981' },
  { id: 'D', label: 'Delta', value: 16, color: '#f59e0b' },
  { id: 'E', label: 'Epsilon', value: 14, color: '#ef4444' },
]

const value = d => d.value
const color = d => d.color
const labelFormatter = d => `${d.label} (${d.value})`

// Label configuration state
const labelState = {
  position: 'inside', // 'inside' | 'outside'
  showLines: false,
  // fine-grained label options for extension
  labelOptions: {
    visible: true,
    offset: 14,
    textStyle: { fontSize: 12, fill: '#1f2937', fontWeight: 500 },
    formatter: labelFormatter,
    labelLine: { stroke: '#475569', strokeWidth: 1, length1: 8, length2: 12 },
  },
}

// Build chart
const el = document.getElementById('chart')

const donut = new Donut({
  value,
  color,
  padAngle: 0.01,
  cornerRadius: 2,
  arcWidth: 42,
})

const container = new VisSingleContainer(el, {
  height: 420,
}, [donut])

container.data = data

// Add a label overlay layer bound to the donut's SVG group
// We will create our own SVG layer on top of Donut to draw labels and connectors.
const svg = el.querySelector('svg')
const rootG = svg.querySelector('g')
const labelLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
labelLayer.setAttribute('class', 'label-layer')
rootG.appendChild(labelLayer)

function getDonutGeometry() {
  // Unovis draws donut centered in plot area; we derive radii from component API
  // Fallbacks if private fields are not accessible
  const bbox = svg.getBoundingClientRect()
  const width = bbox.width
  const height = bbox.height
  const cx = width / 2
  const cy = height / 2
  const outerRadius = Math.min(width, height) / 2 - 8
  const innerRadius = outerRadius - (donut.config?.arcWidth ?? 42)
  return { cx, cy, innerRadius, outerRadius }
}

function computeArcs() {
  const total = data.reduce((s, d) => s + value(d), 0)
  let acc = 0
  return data.map(d => {
    const v = value(d)
    const startAngle = (acc / total) * Math.PI * 2 - Math.PI / 2
    acc += v
    const endAngle = (acc / total) * Math.PI * 2 - Math.PI / 2
    return { data: d, startAngle, endAngle }
  })
}

function arcMidAngle(a) {
  return (a.startAngle + a.endAngle) / 2
}

function polarToCartesian(cx, cy, r, angle) {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
}

function renderLabels() {
  // Clear layer
  while (labelLayer.firstChild) labelLayer.removeChild(labelLayer.firstChild)
  if (!labelState.labelOptions.visible) return

  const { cx, cy, innerRadius, outerRadius } = getDonutGeometry()
  const arcs = computeArcs()
  const { offset, formatter, textStyle, labelLine } = labelState.labelOptions
  const fontSize = textStyle?.fontSize ?? 12

  arcs.forEach(a => {
    const mid = arcMidAngle(a)
    const isOutside = labelState.position === 'outside'
    const rForText = isOutside ? outerRadius + offset : (innerRadius + outerRadius) / 2
    const pos = polarToCartesian(cx, cy, rForText, mid)

    // Connector line (optional, only outside)
    if (isOutside && labelState.showLines) {
      const r1 = outerRadius + 2
      const elbow1 = polarToCartesian(cx, cy, r1, mid)
      const r2 = outerRadius + labelLine.length1
      const elbow2 = polarToCartesian(cx, cy, r2, mid)
      const horizontal = labelLine.length2 * (Math.cos(mid) >= 0 ? 1 : -1)
      const end = { x: elbow2.x + horizontal, y: elbow2.y }

      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
      pl.setAttribute('points', `${elbow1.x},${elbow1.y} ${elbow2.x},${elbow2.y} ${end.x},${end.y}`)
      pl.setAttribute('stroke', labelLine.stroke || '#475569')
      pl.setAttribute('stroke-width', (labelLine.strokeWidth ?? 1).toString())
      pl.setAttribute('fill', 'none')
      labelLayer.appendChild(pl)

      // shift label to end of horizontal segment with a small margin
      pos.x = end.x + (Math.cos(mid) >= 0 ? 4 : -4)
      pos.y = end.y
    }

    // Text label
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    t.textContent = formatter(a.data)
    t.setAttribute('x', pos.x.toFixed(2))
    t.setAttribute('y', pos.y.toFixed(2))
    t.setAttribute('font-size', String(fontSize))
    if (textStyle?.fontWeight) t.setAttribute('font-weight', String(textStyle.fontWeight))
    t.setAttribute('fill', textStyle?.fill || '#1f2937')
    t.setAttribute('text-anchor', isOutside ? (Math.cos(mid) >= 0 ? 'start' : 'end') : 'middle')
    t.setAttribute('dominant-baseline', 'middle')
    labelLayer.appendChild(t)
  })
}

// Initial render
renderLabels()

// Re-render on window resize
const resizeObserver = new ResizeObserver(() => {
  queueMicrotask(renderLabels)
})
resizeObserver.observe(el)

// Controls
const labelPositionSelect = document.getElementById('labelPosition')
const showLinesCheckbox = document.getElementById('showLines')
const showLinesLabel = document.getElementById('showLinesLabel')

labelPositionSelect.addEventListener('change', e => {
  labelState.position = e.target.value
  showLinesLabel.style.display = labelState.position === 'outside' ? 'inline-flex' : 'none'
  renderLabels()
})

showLinesCheckbox.addEventListener('change', e => {
  labelState.showLines = e.target.checked
  renderLabels()
})

// Expose a configurable API (optional) if embedded
export function updateLabelOptions(opts) {
  Object.assign(labelState.labelOptions, opts)
  renderLabels()
}

