// Small, dependency-free behaviour: mobile menu, slide/fade-in on scroll, count-up statistics and the
// appointment form. The form does not store anything: it copies the visitor's
// request and opens a Telegram chat with the clinic, where they paste it.
;(function () {
  var btn = document.querySelector('.menu-btn')
  var nav = document.getElementById('nav')
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open')
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
    })
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Header gains a soft shadow once the page scrolls.
  var header = document.querySelector('.site-header')
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
  }

  // Counts a number up when its statistic scrolls into view.
  function countUp(el) {
    var target = parseInt(el.textContent, 10)
    if (isNaN(target) || String(target) !== el.textContent.trim()) return
    var start = null
    function step(ts) {
      if (start === null) start = ts
      var p = Math.min((ts - start) / 1100, 1)
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(step)
    }
    el.textContent = '0'
    requestAnimationFrame(step)
  }

  if (!reduce && 'IntersectionObserver' in window) {
    // Items slide in from below; the two halves of a split layout slide in from
    // opposite sides; siblings in a grid arrive one after another.
    var selector = [
      '.card',
      '.section h2',
      '.section .eyebrow',
      '.section .muted',
      '.section .lead',
      '.cta .wrap',
      '.faq',
      '.ticks li',
      '.stat-row > div',
      '.shot',
      '.ba',
      '.steps li',
      '.contact-list li',
      '.empty',
      '.map',
    ].join(',')
    var items = Array.prototype.slice.call(document.querySelectorAll(selector))
    document
      .querySelectorAll('.grid, .shots, .stat-row, .ticks, .steps, .contact-list')
      .forEach(function (group) {
        Array.prototype.forEach.call(group.children, function (child, i) {
          child.style.setProperty('--d', Math.min(i * 90, 540) + 'ms')
        })
      })
    document.querySelectorAll('.split').forEach(function (split) {
      if (split.children[0]) split.children[0].classList.add('from-left')
      if (split.children[1]) split.children[1].classList.add('from-right')
      Array.prototype.forEach.call(split.children, function (child) {
        if (items.indexOf(child) === -1) items.push(child)
      })
    })
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return
          e.target.classList.add('in')
          if (e.target.matches('.stat-row > div')) countUp(e.target.querySelector('strong'))
          io.unobserve(e.target)
        })
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' }
    )
    items.forEach(function (el) {
      el.classList.add('reveal')
      io.observe(el)
    })
    // Never leave content hidden if the observer does not fire.
    setTimeout(function () {
      items.forEach(function (el) {
        el.classList.add('in')
      })
    }, 3000)
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
