import { BREAKPOINT } from "@angular/flex-layout";

const CUSTOM_BREAKPOINTS = [
  {
    alias: "sm",
    suffix: "sm",
    mediaQuery: "screen and (min-width: 780px) and (max-width: 959px)",
    overlapping: false
  }
]

export const CustomBreakPointsProvider = {
  provide: BREAKPOINT,
  useValue: CUSTOM_BREAKPOINTS,
  multi: true
}