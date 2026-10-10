import './marketing.js'
import './home.css'

const header = document.querySelector('.home-header')
const menuToggle = header?.querySelector('.home-menu-toggle')
const navigation = header?.querySelector('#home-navigation')

if (menuToggle && navigation) {
  const mobileLayout = window.matchMedia('(max-width: 800px)')

  function setMenuOpen(isOpen) {
    header.classList.toggle('home-header--menu-open', isOpen)
    menuToggle.setAttribute('aria-expanded', String(isOpen))
    menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu')
  }

  header.classList.add('home-header--collapsible')
  menuToggle.hidden = false

  menuToggle.addEventListener('click', () => {
    setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true')
  })

  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(false)
  })

  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) setMenuOpen(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menuToggle.getAttribute('aria-expanded') !== 'true') return
    setMenuOpen(false)
    menuToggle.focus()
  })

  header.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) setMenuOpen(false)
  })

  mobileLayout.addEventListener('change', () => {
    if (mobileLayout.matches && navigation.contains(document.activeElement)) menuToggle.focus()
    setMenuOpen(false)
  })
}
