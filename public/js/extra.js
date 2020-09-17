/* eslint-env browser, jquery */
/* global moment, serverurl, plantumlServer, L */

import PDFObject from 'pdfobject'
import { saveAs } from 'file-saver'

import escapeHTML from 'lodash/escape'
import unescapeHTML from 'lodash/unescape'

import isURL from 'validator/lib/isURL'

import { stripTags } from '../../utils/string'

import getUIElements from './lib/editor/ui-elements'
import { emojifyImageDir } from './lib/editor/constants'
import {
  parseFenceCodeParams,
  serializeParamToAttribute,
  deserializeParamAttributeFromElement
} from './lib/markdown/utils'
import './lib/renderer/lightbox'


import markdownit from 'markdown-it'

require('./lib/common/login')
require('../vendor/md-toc')


const ui = getUIElements()

// auto update last change
window.createtime = null
window.lastchangetime = null
window.lastchangeui = {
  status: $('.ui-status-lastchange'),
  time: $('.ui-lastchange'),
  user: $('.ui-lastchangeuser'),
  nouser: $('.ui-no-lastchangeuser')
}

const ownerui = $('.ui-owner')

export function updateLastChange () {
  if (!window.lastchangeui) return
  if (window.createtime) {
    if (window.createtime && !window.lastchangetime) {
      window.lastchangeui.status.text('created')
    } else {
      window.lastchangeui.status.text('changed')
    }
    const time = window.lastchangetime || window.createtime
    window.lastchangeui.time.html(moment(time).fromNow())
    window.lastchangeui.time.attr('title', moment(time).format('llll'))
  }
}
setInterval(updateLastChange, 60000)

window.lastchangeuser = null
window.lastchangeuserprofile = null

export function updateLastChangeUser () {
  if (window.lastchangeui) {
    if (window.lastchangeuser && window.lastchangeuserprofile) {
      const icon = window.lastchangeui.user.children('i')
      icon.attr('title', window.lastchangeuserprofile.name).tooltip('fixTitle')
      if (window.lastchangeuserprofile.photo) { icon.attr('style', `background-image:url(${window.lastchangeuserprofile.photo})`) }
      window.lastchangeui.user.show()
      window.lastchangeui.nouser.hide()
    } else {
      window.lastchangeui.user.hide()
      window.lastchangeui.nouser.show()
    }
  }
}

window.owner = null
window.ownerprofile = null

export function updateOwner () {
  if (ownerui) {
    if (window.owner && window.ownerprofile && window.owner !== window.lastchangeuser) {
      const icon = ownerui.children('i')
      icon.attr('title', window.ownerprofile.name).tooltip('fixTitle')
      const styleString = `background-image:url(${window.ownerprofile.photo})`
      if (window.ownerprofile.photo && icon.attr('style') !== styleString) { icon.attr('style', styleString) }
      ownerui.show()
    } else {
      ownerui.hide()
    }
  }
}

// get title
function getTitle (view) {
  let title = ''
  if (md && md.meta && md.meta.title && (typeof md.meta.title === 'string' || typeof md.meta.title === 'number')) {
    title = md.meta.title
  } else {
    const h1s = view.find('h1')
    if (h1s.length > 0) {
      title = h1s.first().text()
    } else {
      title = null
    }
  }
  return title
}

// render title
export function renderTitle (view) {
  let title = getTitle(view)
  if (title) {
    title += ' - CodiLIA'
  } else {
    title = 'CodiLIA - Collaborative LiaScript online courses'
  }
  return title
}

// render filename
export function renderFilename (view) {
  let filename = getTitle(view)
  if (!filename) {
    filename = 'Untitled'
  }
  return filename
}

// render tags
export function renderTags (view) {
  const tags = []
  const rawtags = []
  if (md && md.meta && md.meta.tags && (typeof md.meta.tags === 'string' || typeof md.meta.tags === 'number')) {
    const metaTags = (`${md.meta.tags}`).split(',')
    for (let i = 0; i < metaTags.length; i++) {
      const text = metaTags[i].trim()
      if (text) rawtags.push(text)
    }
  } else {
    view.find('h6').each((key, value) => {
      if (/^tags/gmi.test($(value).text())) {
        const codes = $(value).find('code')
        for (let i = 0; i < codes.length; i++) {
          const text = codes[i].innerHTML.trim()
          if (text) rawtags.push(text)
        }
      }
    })
  }
  for (let i = 0; i < rawtags.length; i++) {
    let found = false
    for (let j = 0; j < tags.length; j++) {
      if (tags[j] === rawtags[i]) {
        found = true
        break
      }
    }
    if (!found) { tags.push(rawtags[i]) }
  }
  return tags
}

function slugifyWithUTF8 (text) {
  // remove HTML tags and trim spaces
  let newText = stripTags(text.toString().trim())
  // replace space between words with dashes
  newText = newText.replace(/\s+/g, '-')
  // slugify string to make it valid as an attribute
  newText = newText.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '')
  return newText
}

// parse meta
export function parseMeta (md, edit, view, toc, tocAffix) {
  let lang = null
  let dir = null
  let breaks = window.defaultUseHardbreak
  if (md && md.meta) {
    const meta = md.meta
    lang = meta.lang
    dir = meta.dir
    breaks = meta.breaks
  }
  // text language
  if (lang && typeof lang === 'string') {
    view.attr('lang', lang)
    toc.attr('lang', lang)
    tocAffix.attr('lang', lang)
    if (edit) { edit.attr('lang', lang) }
  } else {
    view.removeAttr('lang')
    toc.removeAttr('lang')
    tocAffix.removeAttr('lang')
    if (edit) { edit.removeAttr('lang', lang) }
  }
  // text direction
  if (dir && typeof dir === 'string') {
    view.attr('dir', dir)
    toc.attr('dir', dir)
    tocAffix.attr('dir', dir)
  } else {
    view.removeAttr('dir')
    toc.removeAttr('dir')
    tocAffix.removeAttr('dir')
  }
  // breaks
  if (typeof breaks === 'boolean') {
    md.options.breaks = breaks
  } else {
    md.options.breaks = window.defaultUseHardbreak
  }
}

window.viewAjaxCallback = null

// regex for extra tags
const spaceregex = /\s*/
const notinhtmltagregex = /(?![^<]*>|[^<>]*<\/)/
let coloregex = /\[color=([#|(|)|\s|,|\w]*?)\]/
coloregex = new RegExp(coloregex.source + notinhtmltagregex.source, 'g')
let nameregex = /\[name=(.*?)\]/
let timeregex = /\[time=([:|,|+|-|(|)|\s|\w]*?)\]/
const nameandtimeregex = new RegExp(nameregex.source + spaceregex.source + timeregex.source + notinhtmltagregex.source, 'g')
nameregex = new RegExp(nameregex.source + notinhtmltagregex.source, 'g')
timeregex = new RegExp(timeregex.source + notinhtmltagregex.source, 'g')

function replaceExtraTags (html) {
  html = html.replace(coloregex, '<span class="color" data-color="$1"></span>')
  html = html.replace(nameandtimeregex, '<small><i class="fa fa-user"></i> $1 <i class="fa fa-clock-o"></i> $2</small>')
  html = html.replace(nameregex, '<small><i class="fa fa-user"></i> $1</small>')
  html = html.replace(timeregex, '<small><i class="fa fa-clock-o"></i> $1</small>')
  return html
}

//if (typeof window.mermaid !== 'undefined' && window.mermaid) window.mermaid.startOnLoad = false

// dynamic event or object binding here
export function finishView (view) {
  // todo list
  const lis = view.find('li.raw').removeClass('raw').sortByDepth().toArray()

  for (let li of lis) {
    let html = $(li).clone()[0].innerHTML
    const p = $(li).children('p')
    if (p.length === 1) {
      html = p.html()
      li = p[0]
    }
    html = replaceExtraTags(html)
    li.innerHTML = html
    let disabled = 'disabled'
    if (typeof editor !== 'undefined' && window.havePermission()) { disabled = '' }
    if (/^\s*\[[x ]]\s*/.test(html)) {
      li.innerHTML = html.replace(/^\s*\[ ]\s*/, `<input type="checkbox" class="task-list-item-checkbox "${disabled}><label></label>`)
        .replace(/^\s*\[x]\s*/, `<input type="checkbox" class="task-list-item-checkbox" checked ${disabled}><label></label>`)
      if (li.tagName.toLowerCase() !== 'li') {
        li.parentElement.setAttribute('class', 'task-list-item')
      } else {
        li.setAttribute('class', 'task-list-item')
      }
    }
    if (typeof editor !== 'undefined' && window.havePermission()) { $(li).find('input').change(toggleTodoEvent) }
    // color tag in list will convert it to tag icon with color
    const tagColor = $(li).closest('ul').find('.color')
    tagColor.each((key, value) => {
      $(value).addClass('fa fa-tag').css('color', $(value).attr('data-color'))
    })
  }

  // register details toggle for scrollmap recalulation
  view.find('details.raw').removeClass('raw').each(function (key, val) {
    $(val).on('toggle', window.viewAjaxCallback)
  })

  // render title
  document.title = renderTitle(view)
}

// only static transform should be here
export function postProcess (code) {
  const result = $(`<div>${code}</div>`)
  // process style tags
  result.find('style').each((key, value) => {
    let html = $(value).html()
    // unescape > symbel inside the style tags
    html = html.replace(/&gt;/g, '>')
    // remove css @import to prevent XSS
    html = html.replace(/@import url\(([^)]*)\);?/gi, '')
    $(value).html(html)
  })
  // link should open in new window or tab
  // also add noopener to prevent clickjacking
  // See details: https://mathiasbynens.github.io/rel-noopener/
  result.find('a:not([href^="#"]):not([target])').attr('target', '_blank').attr('rel', 'noopener')
  // update continue line numbers
  const linenumberdivs = result.find('.gutter.linenumber').toArray()
  for (let i = 0; i < linenumberdivs.length; i++) {
    if ($(linenumberdivs[i]).hasClass('continue')) {
      const startnumber = linenumberdivs[i - 1] ? parseInt($(linenumberdivs[i - 1]).find('> span').last().attr('data-linenumber')) : 0
      $(linenumberdivs[i]).find('> span').each((key, value) => {
        $(value).attr('data-linenumber', startnumber + key + 1)
      })
    }
  }
  // show yaml meta paring error
  if (md.metaError) {
    var warning = result.find('div#meta-error')
    if (warning && warning.length > 0) {
      warning.text(md.metaError)
    } else {
      warning = $(`<div id="meta-error" class="alert alert-warning">${escapeHTML(md.metaError)}</div>`)
      result.prepend(warning)
    }
  }
  return result
}
window.postProcess = postProcess

var domevents = Object.getOwnPropertyNames(document).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(document)))).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(window))).filter(function (i) {
  return !i.indexOf('on') && (document[i] === null || typeof document[i] === 'function')
}).filter(function (elem, pos, self) {
  return self.indexOf(elem) === pos
})

export function removeDOMEvents (view) {
  for (var i = 0, l = domevents.length; i < l; i++) {
    view.find('[' + domevents[i] + ']').removeAttr(domevents[i])
  }
}
window.removeDOMEvents = removeDOMEvents

function generateCleanHTML (view) {
  const src = view.clone()
  const eles = src.find('*')
  // remove syncscroll parts
  eles.removeClass('part')
  src.find('*[class=""]').removeAttr('class')
  eles.removeAttr('data-startline data-endline')
  src.find("a[href^='#'][smoothhashscroll]").removeAttr('smoothhashscroll')
  // remove gist content
  //src.find('code[data-gist-id]').children().remove()
  // disable todo list
  src.find('input.task-list-item-checkbox').attr('disabled', '')
  // replace emoji image path
  src.find('img.emoji').each((key, value) => {
    let name = $(value).attr('alt')
    name = name.substr(1)
    name = name.slice(0, name.length - 1)
    $(value).attr('src', `https://cdn.jsdelivr.net/npm/@hackmd/emojify.js@2.1.0/dist/images/basic/${name}.png`)
  })
  // replace video to iframe
  src.find('div[data-videoid]').each((key, value) => {
    const id = $(value).attr('data-videoid')
    const style = $(value).attr('style')
    let url = null
    if ($(value).hasClass('youtube')) {
      url = 'https://www.youtube.com/embed/'
    } else if ($(value).hasClass('vimeo')) {
      url = 'https://player.vimeo.com/video/'
    }
    if (url) {
      const iframe = $('<iframe frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>')
      iframe.attr('src', url + id)
      iframe.attr('style', style)
      $(value).html(iframe)
    }
  })
  return src
}

export function exportToRawHTML (view) {
  const filename = `${renderFilename(ui.area.markdown)}.html`
  const src = generateCleanHTML(view)
  $(src).find('a.anchor').remove()
  const html = src[0].outerHTML
  const blob = new Blob([html], {
    type: 'text/html;charset=utf-8'
  })
  saveAs(blob, filename, true)
}

// extract markdown body to html and compile to template
export function exportToHTML (view) {
  const title = renderTitle(ui.area.markdown)
  const filename = `${renderFilename(ui.area.markdown)}.html`
  const src = generateCleanHTML(view)
  // generate toc
  const toc = $('#ui-toc').clone()
  toc.find('*').removeClass('active').find("a[href^='#'][smoothhashscroll]").removeAttr('smoothhashscroll')
  const tocAffix = $('#ui-toc-affix').clone()
  tocAffix.find('*').removeClass('active').find("a[href^='#'][smoothhashscroll]").removeAttr('smoothhashscroll')
  // generate html via template
  $.get(`${serverurl}/build/html.min.css`, css => {
    $.get(`${serverurl}/views/html.hbs`, data => {
      const template = window.Handlebars.compile(data)
      const context = {
        url: serverurl,
        title,
        css,
        html: src[0].outerHTML,
        'ui-toc': toc.html(),
        'ui-toc-affix': tocAffix.html(),
        lang: (md && md.meta && md.meta.lang) ? `lang="${md.meta.lang}"` : null,
        dir: (md && md.meta && md.meta.dir) ? `dir="${md.meta.dir}"` : null
      }
      const html = template(context)
      //        console.log(html);
      const blob = new Blob([html], {
        type: 'text/html;charset=utf-8'
      })
      saveAs(blob, filename, true)
    })
  })
}

// jQuery sortByDepth
$.fn.sortByDepth = function () {
  const ar = this.map(function () {
    return {
      length: $(this).parents().length,
      elt: this
    }
  }).get()

  const result = []
  let i = ar.length
  ar.sort((a, b) => a.length - b.length)
  while (i--) {
    result.push(ar[i].elt)
  }
  return $(result)
}

function toggleTodoEvent (e) {
  const startline = $(this).closest('li').attr('data-startline') - 1
  const line = window.editor.getLine(startline)
  const matches = line.match(/^[>\s-]*[-+*]\s\[([x ])\]/)
  if (matches && matches.length >= 2) {
    let checked = null
    if (matches[1] === 'x') { checked = true } else if (matches[1] === ' ') { checked = false }
    const replacements = matches[0].match(/(^[>\s-]*[-+*]\s\[)([x ])(\])/)
    window.editor.replaceRange(checked ? ' ' : 'x', {
      line: startline,
      ch: replacements[1].length
    }, {
      line: startline,
      ch: replacements[1].length + 1
    }, '+input')
  }
}

// remove hash
function removeHash () {
  history.pushState('', document.title, window.location.pathname + window.location.search)
}

let tocExpand = false

function checkExpandToggle () {
  const toc = $('.ui-toc-dropdown .toc')
  const toggle = $('.expand-toggle')
  if (!tocExpand) {
    toc.removeClass('expand')
    toggle.text('Expand all')
  } else {
    toc.addClass('expand')
    toggle.text('Collapse all')
  }
}

// toc
export function generateToc (id) {
  const target = $(`#${id}`)
  target.html('')
  /* eslint-disable no-unused-vars */
  var toc = new window.Toc('doc', {
    level: 3,
    top: -1,
    class: 'toc',
    ulClass: 'nav',
    targetId: id,
    process: getHeaderContent
  })
  /* eslint-enable no-unused-vars */
  if (target.text() === 'undefined') { target.html('') }
  const tocMenu = $('<div class="toc-menu"></div')
  const toggle = $('<a class="expand-toggle" href="#">Expand all</a>')
  const backtotop = $('<a class="back-to-top" href="#">Back to top</a>')
  const gotobottom = $('<a class="go-to-bottom" href="#">Go to bottom</a>')
  checkExpandToggle()
  toggle.click(e => {
    e.preventDefault()
    e.stopPropagation()
    tocExpand = !tocExpand
    checkExpandToggle()
  })
  backtotop.click(e => {
    e.preventDefault()
    e.stopPropagation()
    if (window.scrollToTop) { window.scrollToTop() }
    removeHash()
  })
  gotobottom.click(e => {
    e.preventDefault()
    e.stopPropagation()
    if (window.scrollToBottom) { window.scrollToBottom() }
    removeHash()
  })
  tocMenu.append(toggle).append(backtotop).append(gotobottom)
  target.append(tocMenu)
}

// smooth all hash trigger scrolling
export function smoothHashScroll () {
  const hashElements = $("a[href^='#']:not([smoothhashscroll])").toArray()

  for (const element of hashElements) {
    const $element = $(element)
    const hash = element.hash
    if (hash) {
      $element.on('click', function (e) {
        // store hash
        const hash = decodeURIComponent(this.hash)
        // escape special characters in jquery selector
        const $hash = $(hash.replace(/(:|\.|\[|\]|,)/g, '\\$1'))
        // return if no element been selected
        if ($hash.length <= 0) return
        // prevent default anchor click behavior
        e.preventDefault()
        // animate
        $('body, html').stop(true, true).animate({
          scrollTop: $hash.offset().top
        }, 100, 'linear', () => {
          // when done, add hash to url
          // (default click behaviour)
          window.location.hash = hash
        })
      })
      $element.attr('smoothhashscroll', '')
    }
  }
}

function imgPlayiframe (element, src) {
  if (!$(element).attr('data-videoid')) return
  const iframe = $("<iframe frameborder='0' webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>")
  $(iframe).attr('src', `${src + $(element).attr('data-videoid')}?autoplay=1`)
  $(element).find('img').css('visibility', 'hidden')
  $(element).append(iframe)
}

const anchorForId = id => {
  const anchor = document.createElement('a')
  anchor.className = 'anchor hidden-xs'
  anchor.href = `#${id}`
  anchor.innerHTML = '<i class="fa fa-link"></i>'
  anchor.title = id
  return anchor
}

const createHeaderId = (headerContent, headerIds = null) => {
  // to escape characters not allow in css and humanize
  const slug = slugifyWithUTF8(headerContent)
  let id
  if (window.linkifyHeaderStyle === 'keep-case') {
    id = slug
  } else if (window.linkifyHeaderStyle === 'lower-case') {
    // to make compatible with GitHub, GitLab, Pandoc and many more
    id = slug.toLowerCase()
  } else if (window.linkifyHeaderStyle === 'gfm') {
    // see GitHub implementation reference:
    // https://gist.github.com/asabaylus/3071099#gistcomment-1593627
    // it works like 'lower-case', but ...
    const idBase = slug.toLowerCase()
    id = idBase
    if (headerIds !== null) {
      // ... making sure the id is unique
      let i = 1
      while (headerIds.has(id)) {
        id = idBase + '-' + i
        i++
      }
      headerIds.add(id)
    }
  } else {
    throw new Error('Unknown linkifyHeaderStyle value "' + window.linkifyHeaderStyle + '"')
  }
  return id
}

const linkifyAnchors = (level, containingElement) => {
  const headers = containingElement.getElementsByTagName(`h${level}`)

  for (let i = 0, l = headers.length; i < l; i++) {
    const header = headers[i]
    if (header.getElementsByClassName('anchor').length === 0) {
      if (typeof header.id === 'undefined' || header.id === '') {
        header.id = createHeaderId(getHeaderContent(header))
      }
      if (!(typeof header.id === 'undefined' || header.id === '')) {
        header.insertBefore(anchorForId(header.id), header.firstChild)
      }
    }
  }
}

export function autoLinkify (view) {
  const contentBlock = view[0]
  if (!contentBlock) {
    return
  }
  for (let level = 1; level <= 6; level++) {
    linkifyAnchors(level, contentBlock)
  }
}

function getHeaderContent (header) {
  const headerHTML = $(header).clone()
  //headerHTML.find('.MathJax_Preview').remove()
  //headerHTML.find('.MathJax').remove()
  return headerHTML[0].innerHTML
}

function changeHeaderId ($header, id, newId) {
  $header.attr('id', newId)
  const $headerLink = $header.find(`> a.anchor[href="#${id}"]`)
  $headerLink.attr('href', `#${newId}`)
  $headerLink.attr('title', newId)
}

export function deduplicatedHeaderId (view) {
  // headers contained in the last change
  const headers = view.find(':header.raw').removeClass('raw').toArray()
  if (headers.length === 0) {
    return
  }
  if (window.linkifyHeaderStyle === 'gfm') {
    // consistent with GitHub, GitLab, Pandoc & co.
    // all headers contained in the document, in order of appearance
    const allHeaders = view.find(`:header`).toArray()
    // list of finaly assigned header IDs
    const headerIds = new Set()
    for (let j = 0; j < allHeaders.length; j++) {
      const $header = $(allHeaders[j])
      const id = $header.attr('id')
      const newId = createHeaderId(getHeaderContent($header), headerIds)
      changeHeaderId($header, id, newId)
    }
  } else {
    // the legacy way
    for (let i = 0; i < headers.length; i++) {
      const id = $(headers[i]).attr('id')
      if (!id) continue
      const duplicatedHeaders = view.find(`:header[id="${id}"]`).toArray()
      for (let j = 0; j < duplicatedHeaders.length; j++) {
        if (duplicatedHeaders[j] !== headers[i]) {
          const newId = id + j
          const $header = $(duplicatedHeaders[j])
          changeHeaderId($header, id, newId)
        }
      }
    }
  }
}

export function renderTOC (view) {
  const tocs = view.find('.toc').toArray()
  for (let i = 0; i < tocs.length; i++) {
    const toc = $(tocs[i])
    const id = `toc${i}`
    toc.attr('id', id)
    const target = $(`#${id}`)
    target.html('')
    /* eslint-disable no-unused-vars */
    const TOC = new window.Toc('doc', {
      level: 3,
      top: -1,
      class: 'toc',
      targetId: id,
      process: getHeaderContent
    })
    /* eslint-enable no-unused-vars */
    if (target.text() === 'undefined') { target.html('') }
    target.replaceWith(target.html())
  }
}

const fenceCodeAlias = {
  //sequence: 'sequence-diagram',
  //flow: 'flow-chart',
  //graphviz: 'graphviz',
  //mermaid: 'mermaid',
  //abc: 'abc',
  //vega: 'vega',
  //geo: 'geo',
  //fretboard: 'fretboard_instance',
  //markmap: 'markmap'
}

export const md = markdownit('default', {
  html: true,
  breaks: window.defaultUseHardbreak,
  langPrefix: '',
  linkify: true,
  typographer: true
})
window.md = md

window.emojify.setConfig({
  blacklist: {
    elements: ['script', 'textarea', 'a', 'pre', 'code', 'svg'],
    classes: ['no-emojify']
  },
  img_dir: emojifyImageDir,
  ignore_emoticons: true
})

const defaultImageRender = md.renderer.rules.image
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('class', 'raw')
  tokens[idx].attrJoin('class', 'md-image')
  return defaultImageRender(...arguments)
}
md.renderer.rules.list_item_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('class', 'raw')
  return self.renderToken(...arguments)
}
md.renderer.rules.blockquote_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('class', 'raw')
  return self.renderToken(...arguments)
}
md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrJoin('class', 'raw')
  return self.renderToken(...arguments)
}


// yaml meta, from https://github.com/eugeneware/remarkable-meta
function get (state, line) {
  const pos = state.bMarks[line]
  const max = state.eMarks[line]
  return state.src.substr(pos, max - pos)
}

function meta (state, start, end, silent) {
  if (start !== 0 || state.blkIndent !== 0) return false
  if (state.tShift[start] < 0) return false
  if (!get(state, start).match(/^---$/)) return false

  const data = []
  for (var line = start + 1; line < end; line++) {
    const str = get(state, line)
    if (str.match(/^(\.{3}|-{3})$/)) break
    if (state.tShift[line] < 0) break
    data.push(str)
  }

  if (line >= end) return false

  try {
    md.meta = window.jsyaml.safeLoad(data.join('\n')) || {}
    delete md.metaError
  } catch (err) {
    md.metaError = err
    console.warn(err)
    return false
  }

  state.line = line + 1

  return true
}

function metaPlugin (md) {
  md.meta = md.meta || {}
  md.block.ruler.before('code', 'meta', meta, {
    alt: []
  })
}

md.use(metaPlugin)

export default {
  md
}
