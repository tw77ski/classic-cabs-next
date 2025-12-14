# Classic Cabs — UI Engineering Standard (Luxury Edition)

This project uses a premium, luxury-themed UI design. Whenever generating or modifying UI code:

## 🔶 1. Theme Requirements
- Dark theme (#000–#111 backgrounds)
- Gold accents (#d4af37, #e0b94f, #f5d889)
- Subtle glassmorphism (backdrop-blur)
- Depth (shadows, soft glows, 3D hover animations)

## 🔶 2. Components Must:
- Use Tailwind CSS only
- Use rounded-xl or rounded-2xl consistently
- Use animated gold glow for titles
- Use gradient gold buttons:
  - from-yellow-600 → to-yellow-400 (primary)
  - from-yellow-500 → to-yellow-300 (secondary)
- Use smooth transitions: hover:scale-[1.03]

## 🔶 3. Inputs Must:
- Use:
  - bg-white/10
  - border-yellow-600/20
  - text-white
  - p-3 or p-4
  - rounded-lg or rounded-xl
- Support autocomplete where required

## 🔶 4. Layout Rules
- max-width: 3xl centered
- vertical spacing: space-y-6 or space-y-8
- main container animates via `.animate-fade-in`

## 🔶 5. UX Rules
- Autocomplete dropdown: glassmorphism, gold hover
- Multi-stops: draggable in future
- Fare + booking results: pretty printed inside dark/gold box
- Never generate plain HTML—must match this design system

## 🔶 6. Animation Rules
- goldGlow() for major titles
- fadeIn() for containers

Cursor must enforce these rules when ANY UI code is regenerated.
