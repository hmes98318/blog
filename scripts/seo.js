'use strict'

const { escapeHTML, full_url_for, prettyUrls, unescapeHTML } = require('hexo-util')

const pageHeads = new Map()

function setCollectionMetadata (locals) {
  const { page, config, site } = locals
  const pagination = page.current > 1 ? `（第 ${page.current} 頁）` : ''
  const examples = page.posts ? page.posts.limit(2).map(post => post.title).join('、') : ''

  if (page.__index) {
    page.title = pagination ? `文章列表${pagination}` : config.title
    page.description = pagination
      ? `${config.title} 的文章列表${pagination}，這頁有 ${examples} 等文章。`
      : config.description
    page.keywords = config.keywords
  } else if (page.tag || page.category) {
    const topic = page.tag || page.category
    const kind = page.tag ? '標籤' : '分類'
    const collection = (page.tag ? site.tags : site.categories).findOne({ name: topic })
    page.title = `${kind}：${topic}${pagination}`
    page.description = `${kind}「${topic}」下共有 ${collection.length} 篇文章${pagination}，可以找到 ${examples} 等筆記。`
    page.keywords = topic
  } else if (page.archive) {
    const period = page.year ? `${page.year} 年${page.month ? ` ${page.month} 月` : ''}` : '全部'
    page.title = `${period}文章歸檔${pagination}`
    page.description = `按發布時間瀏覽 ${config.title} 的${period}文章${pagination}，包含 ${examples}。`
    page.keywords = config.keywords
  } else if (page.type === '404') {
    page.title = '找不到頁面'
    page.description = '找不到這個頁面，可以回首頁，或從分類、標籤和歸檔找文章。'
  }
}

function structuredData (locals, url) {
  const { page, config, theme } = locals
  const absoluteUrl = path => full_url_for.call(locals, path)
  const home = absoluteUrl('/')
  const author = {
    '@type': 'Person',
    '@id': `${home}#author`,
    'name': config.author,
    'url': theme.post_copyright.author_href
  }
  const website = {
    '@type': 'WebSite',
    '@id': `${home}#website`,
    'url': home,
    'name': config.title,
    'alternateName': theme.structured_data.alternate_name,
    'description': config.description,
    'inLanguage': config.language,
    'publisher': { '@id': author['@id'] }
  }
  const isPost = page.layout === 'post'
  const isCollection = page.__index || page.archive || page.tag || page.category ||
    ['tags', 'categories'].includes(page.type)
  const webpage = {
    '@type': isCollection ? 'CollectionPage' : 'WebPage',
    '@id': `${url}#webpage`,
    url,
    'name': page.title,
    'description': page.description,
    'inLanguage': config.language,
    'isPartOf': { '@id': website['@id'] }
  }
  const graph = [website, author, webpage]
  const breadcrumbs = [{ name: '首頁', item: home }]

  if (isPost) {
    const article = {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      url,
      'headline': page.title,
      'description': page.description,
      'inLanguage': config.language,
      'datePublished': page.date.toISOString(),
      'dateModified': (page.updated || page.date).toISOString(),
      'author': { ...author },
      'publisher': { '@id': author['@id'] },
      'mainEntityOfPage': { '@id': webpage['@id'] },
      'articleSection': page.categories.map(category => category.name)
    }
    if (page.keywords) article.keywords = page.keywords.split(',').map(keyword => keyword.trim()).filter(Boolean)
    if (page.cover_type === 'img') article.image = absoluteUrl(page.cover)
    webpage.mainEntity = { '@id': article['@id'] }
    graph.push(article)
    page.categories.forEach(category => {
      breadcrumbs.push({ name: category.name, item: absoluteUrl(category.path) })
    })
  } else if (page.tag) {
    breadcrumbs.push({ name: '標籤', item: absoluteUrl(`${config.tag_dir}/`) })
  } else if (page.category) {
    breadcrumbs.push({ name: '分類', item: absoluteUrl(`${config.category_dir}/`) })
  } else if (page.archive && page.year) {
    breadcrumbs.push({ name: '歸檔', item: absoluteUrl(`${config.archive_dir}/`) })
  }

  if (url !== home) {
    breadcrumbs.push({ name: page.title, item: url })
    const breadcrumb = {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      'itemListElement': breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        'position': index + 1,
        ...item
      }))
    }
    webpage.breadcrumb = { '@id': breadcrumb['@id'] }
    graph.push(breadcrumb)
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

hexo.extend.filter.register('before_generate', () => pageHeads.clear())

hexo.extend.filter.register('template_locals', locals => {
  setCollectionMetadata(locals)
  const { config, page, theme } = locals
  const url = prettyUrls(locals.url, config.pretty_urls)
  const title = page.__index && page.current === 1
    ? `${config.title} - ${config.subtitle}`
    : `${page.title} | ${config.title}`
  const schema = theme.structured_data.enable && page.type !== '404'
    ? `<script type="application/ld+json">${structuredData(locals, url)}</script>`
    : ''
  const robots = page.type === '404' ? '<meta name="robots" content="noindex, follow">' : ''
  pageHeads.set(url, { title, pageTitle: page.title, schema, robots })
  // Generate JSON-LD once, including pages Butterfly leaves with an empty block.
  locals.theme = { ...theme, structured_data: false }
  return locals
})

hexo.extend.filter.register('after_render:html', html => {
  return html.replace(/<head>([\s\S]*?)<\/head>/i, (match, head) => {
    const canonical = head.match(/<link rel="canonical" href="([^"]+)"/)
    const metadata = canonical && pageHeads.get(unescapeHTML(canonical[1]))
    if (!metadata) return match

    const updatedHead = head
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHTML(metadata.title)}</title>`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHTML(metadata.pageTitle)}">`)
    return `<head>${updatedHead}${metadata.schema}${metadata.robots}</head>`
  })
})

hexo.extend.generator.register('llms', function (locals) {
  const absoluteUrl = path => full_url_for.call(this, path)
  const lines = [
    `# ${this.config.title}`,
    '',
    `> ${this.config.description}`,
    '',
    `作者：${this.config.author}。語言：${this.config.language}。技術教學的適用版本與環境以各篇內文為準。`,
    '',
    '## 文章',
    ''
  ]
  locals.posts.sort('-date').forEach(post => {
    if (!post.published) return
    const description = post.description ? `: ${post.description}` : ''
    lines.push(`- [${post.title}](${absoluteUrl(post.path)})${description}`)
  })
  lines.push(
    '',
    '## 瀏覽與聯絡',
    '',
    `- [文章分類](${absoluteUrl(`${this.config.category_dir}/`)}): 依技術主題瀏覽文章。`,
    `- [文章標籤](${absoluteUrl(`${this.config.tag_dir}/`)}): 查找相關工具與平台。`,
    `- [文章歸檔](${absoluteUrl(`${this.config.archive_dir}/`)}): 依發布時間瀏覽。`,
    `- [留言板](${absoluteUrl('messageboard/')}): 交流與回報文章問題。`,
    `- [作者 GitHub](${this.theme.config.post_copyright.author_href}): 作者的公開程式碼與專案。`,
    ''
  )
  return { path: 'llms.txt', data: lines.join('\n') }
})
