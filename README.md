# Virtual Pen Cursor for Obsidian

An Obsidian plugin that displays an **always-visible virtual cursor** with customizable styles and tactile click animations when using a graphics tablet, stylus, Windows Ink, or mouse—especially in canvas tools like **Excalidraw**.

---

## 💡 Why This Plugin?

When using a stylus with **Windows Ink**, Windows and Chromium (Electron) automatically suppress the hardware mouse cursor on touch/pen contact (`pointerdown`) to simulate a direct screen-writing experience.

On graphics tablets (such as screenless **Wacom Intuos**, **Huion**, or **XP-Pen**) or dual-monitor setups, this makes the cursor completely vanish whenever you click, draw, or write.

**Virtual Pen Cursor** solves this by listening directly to pointer events and drawing a lightweight, hardware-accelerated indicator at the exact pen coordinates that Windows cannot hide.

---

## ✨ Features

- 🎯 **8 Unique Virtual Cursor Styles**:
  - **Virtual dot**: Clean circular indicator with customizable border, fill color, and opacity.
  - **Virtual arrow**: Pixel-perfect Windows-style arrow pointer that never disappears on pen contact.
  - **Virtual brush**: Angled artist paintbrush with distinct bristle tip, metal ferrule, and wooden handle.
  - **Virtual precision reticle**: CAD/technical crosshair with a targeting ring and center dot.
  - **Virtual fountain pen nib**: Elegant calligraphy fountain pen nib.
  - **Virtual sleek pointer**: Modern rounded dark pointer with smooth outline.
  - **Virtual laser pointer**: Glowing neon presentation dot with multi-layer light halos.
  - **Virtual sparkle wand**: Creative magic star wand.
- 💥 **Customizable Click Animations**:
  - Choose between **Expanding ripple ring**, **Particle starburst**, **Soft color pulse**, **Double shockwave**, or **Press shrink only**.
  - Adjust animation color, size (16–80 px), and duration (150–1000 ms).
  - Configure device triggering: Pen only, Mouse only, or Both.
- 🎨 **Full Color & Scale Customization**:
  - Independent color pickers for every cursor style.
  - Global size multiplier slider (0.5× to 3×) to match high-DPI or custom OS pointer sizes.
  - Auto-fade timer after inactivity (or keep always visible).
- 🖼️ **Live Preview Gallery**:
  - Test all cursors, see exact click hotspots, and preview click animations directly inside Settings.
- ⚡ **Granular Device & View Rules**:
  - Configure different cursors for **Mouse** vs. **Pen / Windows Ink**.
  - Apply rules specifically to **Excalidraw views** vs. **Everywhere else in Obsidian**.
  - Built-in exception ensures the Obsidian Settings window always retains the normal system cursor.
- 🚀 **Quick Presets**:
  - One-click setup cards for popular configurations (e.g. *Excalidraw: virtual dot*, *Excalidraw: virtual brush*, *Pen: virtual arrow everywhere*, etc.).

---

## 📦 Installation

### From Community Plugins (Once Approved)
1. In Obsidian, open **Settings > Community plugins**.
2. Turn off **Restricted mode**.
3. Click **Browse** and search for `Virtual Pen Cursor`.
4. Click **Install**, then **Enable**.

### Manual Installation
1. Download `manifest.json`, `main.js`, and `styles.css` from the latest [GitHub Release](https://github.com/Henrique244466666/obsidian-virtual-pen-cursor/releases).
2. Inside your vault folder, navigate to `.obsidian/plugins/` (create the directory if it doesn't exist).
3. Create a folder named `virtual-pen-cursor` and place the downloaded files inside.
4. In Obsidian, reload plugins under **Settings > Community plugins** and toggle **Virtual Pen Cursor** on.

---

## 🛠️ Configuration

Open **Settings > Virtual Pen Cursor**:
1. **Quick presets**: Choose a preconfigured setup or customize individual rules.
2. **Device Rules**:
   - For **Mouse** and **Pen / Windows Ink**, pick the desired cursor behavior:
     - *Leave as is (Obsidian default)*
     - *Windows arrow (native)*
     - *Crosshair (native)*
     - *Hidden (no cursor)*
     - *Virtual dot / arrow / brush / reticle / nib / sleek pointer / laser / wand*
3. **Appearance & Preview**: Click any preview card to test its click animation.
4. **Click Animation**: Customize animation style, size, duration, and color.
5. **Cursor Colors**: Adjust color accents for each virtual cursor.

---

## 🤝 Contributing

Contributions, bug reports, and feature suggestions are welcome!
Feel free to open an [issue](https://github.com/Henrique244466666/obsidian-virtual-pen-cursor/issues) or submit a pull request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
