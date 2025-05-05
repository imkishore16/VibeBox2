declare module 'colorthief' {
  interface ColorThiefStatic {
    new(): ColorThief;
  }

  interface ColorThief {
    getColor(img: HTMLImageElement): [number, number, number];
    getPalette(img: HTMLImageElement, colorCount?: number): [number, number, number][];
  }

  const ColorThief: ColorThiefStatic;
  export default ColorThief;
} 