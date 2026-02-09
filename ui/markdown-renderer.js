// Shared Markdown Renderer for FSB UI (popup + sidepanel)
// Uses marked.js + DOMPurify for safe rendering
// Supports mermaid diagrams and Chart.js charts

// Initialize mermaid if available (runs once when script loads)
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({ startOnLoad: false, theme: 'default' });
}

const FSBMarkdown = (() => {
  // Regex patterns that indicate markdown formatting
  const MD_PATTERNS = [
    /\*\*.+?\*\*/,         // **bold**
    /\*.+?\*/,             // *italic*
    /^#{1,6}\s/m,          // ## headings
    /```[\s\S]*?```/,      // ```code blocks```
    /`[^`]+`/,             // `inline code`
    /^[\-\*]\s/m,          // - list items
    /^\d+\.\s/m,           // 1. ordered list
    /\|.+\|/,              // | table |
    /^>\s/m                // > blockquote
  ];

  const ALLOWED_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'code', 'pre',
    'ul', 'ol', 'li',
    'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'div', 'span', 'canvas',
    'del', 'ins'
  ];

  const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'data-chart-id', 'data-mermaid-id'];

  // Chart color palette
  const CHART_COLORS = [
    'rgba(59, 130, 246, 0.7)',   // blue
    'rgba(239, 68, 68, 0.7)',    // red
    'rgba(34, 197, 94, 0.7)',    // green
    'rgba(245, 158, 11, 0.7)',   // amber
    'rgba(139, 92, 246, 0.7)',   // violet
    'rgba(236, 72, 153, 0.7)',   // pink
    'rgba(6, 182, 212, 0.7)',    // cyan
    'rgba(249, 115, 22, 0.7)'   // orange
  ];

  const CHART_BORDER_COLORS = [
    'rgba(59, 130, 246, 1)',
    'rgba(239, 68, 68, 1)',
    'rgba(34, 197, 94, 1)',
    'rgba(245, 158, 11, 1)',
    'rgba(139, 92, 246, 1)',
    'rgba(236, 72, 153, 1)',
    'rgba(6, 182, 212, 1)',
    'rgba(249, 115, 22, 1)'
  ];

  // Counter for unique IDs
  let blockIdCounter = 0;

  function isAvailable() {
    return typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined';
  }

  function hasMarkdown(text) {
    if (!text || typeof text !== 'string') return false;
    return MD_PATTERNS.some(pattern => pattern.test(text));
  }

  // Extract ```mermaid and ```chart blocks before markdown parsing
  function extractSpecialBlocks(text) {
    const mermaidBlocks = {};
    const chartBlocks = {};

    // Extract ```mermaid blocks
    text = text.replace(/```mermaid\s*\n([\s\S]*?)```/g, (match, content) => {
      const id = 'mermaid_' + (blockIdCounter++);
      mermaidBlocks[id] = content.trim();
      return `<div class="mermaid-container" data-mermaid-id="${id}"></div>`;
    });

    // Extract ```chart blocks
    text = text.replace(/```chart\s*\n([\s\S]*?)```/g, (match, content) => {
      const id = 'chart_' + (blockIdCounter++);
      try {
        chartBlocks[id] = JSON.parse(content.trim());
      } catch (e) {
        // If JSON is invalid, store as null so we can show an error
        chartBlocks[id] = null;
      }
      return `<div class="fsb-chart" data-chart-id="${id}"></div>`;
    });

    return { text, mermaidBlocks, chartBlocks };
  }

  function buildChartConfig(data) {
    if (!data || !data.type || !data.labels || !data.datasets) return null;

    const isPieType = data.type === 'pie' || data.type === 'doughnut';

    const datasets = data.datasets.map((ds, i) => {
      const config = {
        label: ds.label || `Dataset ${i + 1}`,
        data: ds.data
      };

      if (isPieType) {
        config.backgroundColor = CHART_COLORS.slice(0, ds.data.length);
        config.borderColor = CHART_BORDER_COLORS.slice(0, ds.data.length);
        config.borderWidth = 1;
      } else {
        config.backgroundColor = ds.backgroundColor || CHART_COLORS[i % CHART_COLORS.length];
        config.borderColor = ds.borderColor || CHART_BORDER_COLORS[i % CHART_BORDER_COLORS.length];
        config.borderWidth = ds.borderWidth || 2;
        if (data.type === 'line') {
          config.tension = 0.3;
          config.fill = false;
        }
      }

      return config;
    });

    return {
      type: data.type,
      data: {
        labels: data.labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: !!data.title,
            text: data.title || '',
            font: { size: 14 }
          },
          legend: {
            display: datasets.length > 1 || isPieType,
            position: 'bottom'
          },
          tooltip: {
            enabled: true
          }
        },
        scales: isPieType ? {} : {
          y: {
            beginAtZero: true
          }
        }
      }
    };
  }

  function render(text) {
    if (!isAvailable()) return null;

    // Check for special blocks or markdown
    const hasSpecialBlocks = /```(mermaid|chart)\s*\n/.test(text);
    if (!hasSpecialBlocks && !hasMarkdown(text)) return null;

    try {
      // Extract mermaid and chart blocks before markdown parsing
      const extracted = extractSpecialBlocks(text);

      const html = marked.parse(extracted.text, {
        gfm: true,
        breaks: true
      });

      const clean = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ALLOWED_TAGS,
        ALLOWED_ATTR: ALLOWED_ATTR,
        ADD_ATTR: ['target', 'rel']
      });

      // Post-process: add target="_blank" and rel to all links
      const temp = document.createElement('div');
      temp.innerHTML = clean;
      temp.querySelectorAll('a').forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });

      return {
        html: temp.innerHTML,
        mermaidBlocks: extracted.mermaidBlocks,
        chartBlocks: extracted.chartBlocks
      };
    } catch (err) {
      console.error('FSBMarkdown render error:', err);
      return null;
    }
  }

  function applyToElement(el, text) {
    const result = render(text);
    if (result) {
      el.innerHTML = result.html;
      el.classList.add('md-rendered');

      // Render mermaid diagrams
      const mermaidContainers = el.querySelectorAll('.mermaid-container');
      if (mermaidContainers.length > 0 && typeof mermaid !== 'undefined') {
        mermaidContainers.forEach(container => {
          const id = container.dataset.mermaidId;
          const diagramCode = result.mermaidBlocks[id];
          if (diagramCode) {
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.textContent = diagramCode;
            container.appendChild(mermaidDiv);
          }
        });
        const mermaidDivs = el.querySelectorAll('.mermaid');
        if (mermaidDivs.length > 0) {
          mermaid.run({ nodes: Array.from(mermaidDivs) });
        }
      }

      // Render Chart.js charts
      const chartContainers = el.querySelectorAll('.fsb-chart');
      if (chartContainers.length > 0 && typeof Chart !== 'undefined') {
        chartContainers.forEach(container => {
          const id = container.dataset.chartId;
          const chartData = result.chartBlocks[id];
          if (chartData) {
            const config = buildChartConfig(chartData);
            if (config) {
              const canvas = document.createElement('canvas');
              canvas.style.maxHeight = '250px';
              container.appendChild(canvas);
              new Chart(canvas, config);
            }
          }
        });
      }
    } else {
      el.textContent = text;
    }
  }

  return { hasMarkdown, render, applyToElement, isAvailable };
})();
