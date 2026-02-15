# Design System - Vesting Platform

## Paleta de Cores Padronizada

### Amarelo Ouro (Primary/Brand)
- **Principal**: `#EAB308` (gold-500)
- **Hover**: `#CA8A04` (gold-600)
- **Active**: `#A16207` (gold-700)
- **Uso**: Botões primários, destaques, ícones principais, badges de status

### Verde (Success)
- **Principal**: `#22C55E` (green-500)
- **Hover**: `#16A34A` (green-600)
- **Active**: `#15803D` (green-700)
- **Uso**: Status positivo, confirmações, indicadores de sucesso

### Vermelho (Danger/Error)
- **Principal**: `#EF4444` (red-500)
- **Hover**: `#DC2626` (red-600)
- **Active**: `#B91C1C` (red-700)
- **Uso**: Alertas, cancelamentos, erros, ações destrutivas

## Tipografia Mobile-First

### Hierarquia de Tamanhos
- **Títulos de Página**: `text-2xl` (24px / 1.5rem)
- **Títulos de Seção**: `text-xl` (20px / 1.25rem)
- **Subtítulos**: `text-lg` (18px / 1.125rem)
- **Texto Principal**: `text-base` (16px / 1rem)
- **Texto Secundário**: `text-sm` (14px / 0.875rem)
- **Labels/Badges**: `text-xs` (12px / 0.75rem)

### Pesos de Fonte
- **Títulos**: `font-bold` (700)
- **Subtítulos**: `font-semibold` (600)
- **Texto Normal**: `font-normal` (400)
- **Labels**: `font-bold uppercase` (700 + uppercase)

## Padrões de Botões

### Botão Primário (Amarelo Ouro)
```tsx
className="bg-[#EAB308] hover:bg-[#CA8A04] active:bg-[#A16207] text-black font-bold py-3 px-6 rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg"
```

### Botão Secundário (Cinza)
```tsx
className="bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 cursor-pointer"
```

### Botão Sucesso (Verde)
```tsx
className="bg-[#22C55E] hover:bg-[#16A34A] active:bg-[#15803D] text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg"
```

### Botão Perigo (Vermelho)
```tsx
className="bg-[#EF4444] hover:bg-[#DC2626] active:bg-[#B91C1C] text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg"
```

### Botão Outline Perigo
```tsx
className="bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-[#EF4444] font-bold py-3 px-6 rounded-xl transition-all active:scale-95 cursor-pointer border border-red-500/30"
```

## Safe Areas (Mobile)

### Header com Safe Area
```tsx
className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 py-3 safe-header"
```

### Footer com Safe Area
```tsx
className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 safe-footer"
```

### Container com Safe Area
```tsx
className="min-h-screen bg-black text-white safe-container"
```

## Badges de Status

### Em Andamento (Amarelo)
```tsx
className="bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/30 px-3 py-1 rounded-lg text-xs font-bold uppercase"
```

### Sucesso (Verde)
```tsx
className="bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 px-3 py-1 rounded-lg text-xs font-bold uppercase"
```

### Cancelado (Vermelho)
```tsx
className="bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 px-3 py-1 rounded-lg text-xs font-bold uppercase"
```

## Ícones Clicáveis

Sempre adicionar `cursor-pointer` em elementos interativos:
```tsx
className="material-symbols-outlined cursor-pointer hover:text-[#EAB308] transition-colors"
```

## Inputs

### Input Padrão
```tsx
className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-base placeholder:text-zinc-500 placeholder:text-sm focus:outline-none focus:border-[#EAB308]/50 transition-colors"
```

### Label do Input
```tsx
className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block"
```

## Responsividade

### Larguras de Container
- Mobile: `w-full px-4`
- Tablet: `max-w-2xl mx-auto px-6`
- Desktop: `max-w-4xl mx-auto px-8`

### Grid Responsivo
```tsx
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
```

## Espaçamentos

### Margens entre Seções
- Pequeno: `mt-6` (24px)
- Médio: `mt-8` (32px)
- Grande: `mt-12` (48px)

### Padding de Cards
- Pequeno: `p-4` (16px)
- Médio: `p-6` (24px)
- Grande: `p-8` (32px)

## Transições

Sempre adicionar transições suaves:
```tsx
transition-all duration-300
transition-colors duration-200
active:scale-95
hover:opacity-90
```

## Checklist de Implementação

- [ ] Todas as cores amarelas usam `#EAB308` (gold-500)
- [ ] Todas as cores verdes usam `#22C55E` (green-500)
- [ ] Todas as cores vermelhas usam `#EF4444` (red-500)
- [ ] Botões têm `cursor-pointer` e estados hover/active
- [ ] Ícones clicáveis têm `cursor-pointer`
- [ ] Tipografia segue a escala mobile-first
- [ ] Headers e footers usam classes `safe-header` e `safe-footer`
- [ ] Inputs têm tamanhos de fonte adequados (base para texto, sm para placeholder)
- [ ] Transições suaves em todos os elementos interativos
- [ ] Grid responsivo com breakpoints sm/md/lg
