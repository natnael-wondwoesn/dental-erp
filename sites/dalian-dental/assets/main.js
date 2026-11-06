// Small, dependency-free behaviour: mobile menu, header that settles on scroll,
// slide/fade-in reveals, count-up statistics and the appointment form. The form
// stores nothing: it copies the visitor's request and opens a Telegram chat with
// the clinic, where they paste it.
;(function () {
  var btn = document.querySelector('.menu-btn')
  var nav = document.getElementById('nav')
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open')
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
    })
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('open')
        btn.setAttribute('aria-expanded', 'false')
      }
    })
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Header gains a border and shadow and gets a little shorter once the page scrolls.
  var header = document.querySelector('.site-header')
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
  }

  // Counts a statistic up from zero when it scrolls into view.
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10)
    var suffix = el.getAttribute('data-suffix') || ''
    if (isNaN(target) || reduce) return
    var start = null
    function step(ts) {
      if (start === null) start = ts
      var p = Math.min((ts - start) / 1400, 1)
      el.textContent =
        Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US') + suffix
      if (p < 1) requestAnimationFrame(step)
    }
    el.textContent = '0' + suffix
    requestAnimationFrame(step)
  }

  var targets = Array.prototype.slice.call(document.querySelectorAll('[data-r]'))
  if (!reduce && 'IntersectionObserver' in window && targets.length) {
    document.documentElement.classList.add('js-reveal')
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return
          e.target.classList.add('in')
          e.target.querySelectorAll('[data-count]').forEach(countUp)
          io.unobserve(e.target)
        })
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' }
    )
    targets.forEach(function (el) {
      io.observe(el)
    })
    // Never leave content hidden if the observer does not fire.
    setTimeout(function () {
      targets.forEach(function (el) {
        el.classList.add('in')
      })
    }, 4000)
  }

  var form = document.getElementById('appointment')
  if (form) {
    var msg = form.querySelector('.form-msg')
    form.addEventListener('submit', function (ev) {
      ev.preventDefault()
      var f = new FormData(form)
      if (f.get('website')) return // spam trap
      var name = String(f.get('name') || '').trim()
      var phone = String(f.get('phone') || '').trim()
      msg.className = 'form-msg'
      if (name.length < 2 || phone.replace(/\D/g, '').length < 9) {
        msg.className = 'form-msg error'
        msg.textContent = 'Please enter your name and a valid phone number.'
        return
      }
      var lines = [
        'Appointment request - ' + (form.dataset.clinic || ''),
        'Name: ' + name,
        'Phone: ' + phone,
        f.get('email') ? 'Email: ' + f.get('email') : '',
        f.get('service') ? 'Service: ' + f.get('service') : '',
        f.get('date') ? 'Preferred date: ' + f.get('date') : '',
        f.get('time') ? 'Preferred time: ' + f.get('time') : '',
        f.get('message') ? 'Message: ' + f.get('message') : '',
      ].filter(Boolean)
      var user = form.dataset.telegram
      if (user) {
        var text = lines.join('\n')
        var done = function (copied) {
          window.open('https://t.me/' + user, '_blank', 'noopener')
          msg.className = 'form-msg ok'
          msg.textContent = copied
            ? 'Your request is copied. Paste it into the Telegram chat and press send; we will confirm your time.'
            : 'Telegram is opening. Please type your request there and we will confirm your time.'
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () {
              done(true)
            },
            function () {
              done(false)
            }
          )
        } else {
          done(false)
        }
      } else {
        msg.className = 'form-msg error'
        msg.textContent = 'Online requests are not available yet. Please call the clinic to book.'
      }
    })
  }

  // ---- Gallery: category filter, "view all results" and the image lightbox ----
  var gallery = document.getElementById('gallery')
  if (gallery) {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.g-nav a[data-filter]'))
    var sections = Array.prototype.slice.call(gallery.querySelectorAll('.g-section'))
    var applyFilter = function (key, scroll) {
      sections.forEach(function (sec) {
        sec.hidden = !(key === 'all' || sec.getAttribute('data-cat') === key)
      })
      tabs.forEach(function (t) {
        if (t.getAttribute('data-filter') === key) t.setAttribute('aria-current', 'true')
        else t.removeAttribute('aria-current')
      })
      if (scroll) {
        var nav = document.querySelector('.g-nav')
        var top = (nav ? nav.getBoundingClientRect().bottom + window.scrollY : 0) - 8
        window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' })
      }
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault()
        var key = t.getAttribute('data-filter')
        applyFilter(key, true)
        if (history.replaceState)
          history.replaceState(null, '', key === 'all' ? '#gallery' : '#' + key)
      })
    })
    var fromHash = (location.hash || '').replace('#', '')
    if (
      fromHash &&
      tabs.some(function (t) {
        return t.getAttribute('data-filter') === fromHash
      })
    )
      applyFilter(fromHash, false)

    var more = document.querySelector('[data-more-results]')
    if (more) {
      more.addEventListener('click', function () {
        document.querySelector('.case-grid').classList.add('show-all')
        more.parentNode.hidden = true
      })
    }
  }

  var box = null
  var items = []
  var index = 0
  var lastFocus = null
  function build() {
    box = document.createElement('div')
    box.className = 'lightbox'
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-modal', 'true')
    box.setAttribute('aria-label', 'Image viewer')
    box.innerHTML =
      '<button class="lb-btn lb-close" type="button" aria-label="Close">&times;</button>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="Previous image">&#8249;</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button class="lb-btn lb-next" type="button" aria-label="Next image">&#8250;</button>'
    document.body.appendChild(box)
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.closest('.lb-close')) close()
      else if (e.target.closest('.lb-prev')) show(index - 1)
      else if (e.target.closest('.lb-next')) show(index + 1)
    })
    var startX = null
    box.addEventListener(
      'touchstart',
      function (e) {
        startX = e.touches[0].clientX
      },
      { passive: true }
    )
    box.addEventListener('touchend', function (e) {
      if (startX === null) return
      var dx = e.changedTouches[0].clientX - startX
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1))
      startX = null
    })
  }
  function show(i) {
    if (!items.length) return
    index = (i + items.length) % items.length
    var a = items[index]
    var img = box.querySelector('img')
    img.src = a.getAttribute('href')
    img.alt = a.getAttribute('data-caption') || ''
    var cap = box.querySelector('figcaption')
    cap.textContent = a.getAttribute('data-caption') || ''
    if (items.length > 1) {
      var small = document.createElement('small')
      small.textContent = index + 1 + ' / ' + items.length
      cap.appendChild(small)
      var next = new Image()
      next.src = items[(index + 1) % items.length].getAttribute('href')
    }
    box.querySelector('.lb-prev').style.display = items.length > 1 ? '' : 'none'
    box.querySelector('.lb-next').style.display = items.length > 1 ? '' : 'none'
  }
  function open(a) {
    if (!box) build()
    // Only images that are currently visible take part in previous/next.
    items = Array.prototype.slice.call(document.querySelectorAll('a.lb')).filter(function (el) {
      return el.offsetParent !== null
    })
    lastFocus = document.activeElement
    box.classList.add('open')
    document.body.classList.add('lb-open')
    show(Math.max(items.indexOf(a), 0))
    box.querySelector('.lb-close').focus()
  }
  function close() {
    if (!box) return
    box.classList.remove('open')
    document.body.classList.remove('lb-open')
    if (lastFocus && lastFocus.focus) lastFocus.focus()
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.lb')
    if (!a) return
    e.preventDefault()
    open(a)
  })
  document.addEventListener('keydown', function (e) {
    if (!box || !box.classList.contains('open')) return
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowLeft') show(index - 1)
    else if (e.key === 'ArrowRight') show(index + 1)
  })
})()
