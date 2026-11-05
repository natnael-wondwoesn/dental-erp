// Small, dependency-free behaviour: mobile menu, fade-in on scroll, and the
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
  var items = document.querySelectorAll('.card, .section h2, .cta .wrap')
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' }
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
    }, 2500)
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
