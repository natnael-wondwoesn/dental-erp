// Learn hub: topic filters, search and pagination over the article cards.
// Without JavaScript every article is simply listed; this only narrows the list.
;(function () {
  var grid = document.getElementById('learn-grid')
  if (!grid) return
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.acard'))
  var chips = Array.prototype.slice.call(document.querySelectorAll('#learn-chips .chip-btn'))
  var input = document.getElementById('learn-search')
  var form = document.getElementById('learn-search-form')
  var count = document.getElementById('learn-count')
  var empty = document.getElementById('learn-empty')
  var pager = document.getElementById('learn-pager')
  var PER_PAGE = 9
  var state = { cat: 'all', q: '', page: 1 }

  function readUrl() {
    var p = new URLSearchParams(window.location.search)
    state.cat = p.get('cat') || 'all'
    state.q = (p.get('q') || '').toLowerCase()
    state.page = parseInt(p.get('page') || '1', 10) || 1
    if (input) input.value = state.q
  }

  function writeUrl() {
    var p = new URLSearchParams()
    if (state.cat !== 'all') p.set('cat', state.cat)
    if (state.q) p.set('q', state.q)
    if (state.page > 1) p.set('page', String(state.page))
    var qs = p.toString()
    history.replaceState(
      null,
      '',
      window.location.pathname + (qs ? '?' + qs : '') + window.location.hash
    )
  }

  function render() {
    var words = state.q.split(/\s+/).filter(Boolean)
    var matches = cards.filter(function (card) {
      var okCat = state.cat === 'all' || card.getAttribute('data-cat') === state.cat
      var text = card.getAttribute('data-text') || ''
      var okQ = words.every(function (w) {
        return text.indexOf(w) !== -1
      })
      return okCat && okQ
    })
    var pages = Math.max(1, Math.ceil(matches.length / PER_PAGE))
    if (state.page > pages) state.page = pages
    var start = (state.page - 1) * PER_PAGE
    cards.forEach(function (card) {
      card.hidden = true
    })
    matches.slice(start, start + PER_PAGE).forEach(function (card) {
      card.hidden = false
      card.setAttribute('data-r-skip', '')
      card.style.opacity = 1
      card.style.transform = 'none'
    })
    chips.forEach(function (chip) {
      chip.classList.toggle('active', chip.getAttribute('data-cat') === state.cat)
      chip.setAttribute(
        'aria-pressed',
        chip.getAttribute('data-cat') === state.cat ? 'true' : 'false'
      )
    })
    if (empty) empty.hidden = matches.length !== 0
    if (count) {
      count.textContent =
        matches.length === cards.length && !state.q
          ? cards.length + ' articles'
          : matches.length + (matches.length === 1 ? ' article found' : ' articles found')
    }
    if (pager) {
      pager.innerHTML = ''
      if (pages > 1) {
        for (var i = 1; i <= pages; i++) {
          var b = document.createElement('button')
          b.type = 'button'
          b.textContent = String(i)
          b.className = 'page-btn' + (i === state.page ? ' active' : '')
          b.setAttribute('aria-label', 'Page ' + i)
          if (i === state.page) b.setAttribute('aria-current', 'page')
          b.addEventListener(
            'click',
            (function (n) {
              return function () {
                state.page = n
                writeUrl()
                render()
                document
                  .getElementById('latest')
                  .scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            })(i)
          )
          pager.appendChild(b)
        }
      }
    }
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.cat = chip.getAttribute('data-cat')
      state.page = 1
      writeUrl()
      render()
    })
  })
  document.querySelectorAll('a.topic[data-cat]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault()
      state.cat = link.getAttribute('data-cat')
      state.q = ''
      state.page = 1
      if (input) input.value = ''
      writeUrl()
      render()
      document.getElementById('latest').scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
  document.querySelectorAll('.pop a[data-q]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault()
      state.q = link.getAttribute('data-q')
      state.cat = 'all'
      state.page = 1
      if (input) input.value = state.q
      writeUrl()
      render()
      document.getElementById('latest').scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      state.q = (input.value || '').trim().toLowerCase()
      state.cat = 'all'
      state.page = 1
      writeUrl()
      render()
      document.getElementById('latest').scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  if (input) {
    input.addEventListener('input', function () {
      state.q = (input.value || '').trim().toLowerCase()
      state.page = 1
      writeUrl()
      render()
    })
  }
  readUrl()
  render()
})()
