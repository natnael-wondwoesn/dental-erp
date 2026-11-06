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
})()
