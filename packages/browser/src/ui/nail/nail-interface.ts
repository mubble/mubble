/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Jun 19 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

// To lock panning on axis, this threshold should be met, example if user moves 5 pixel in x, his movement
// should be 1 pixel or below on y axis
export const THRESHOLD = .8

// Gutter width: we support gutters on x axis. Gutter touches are reported as a separate callback
// Gutter is always configured wrt to page dimensions, not component dimensions
export const GUTTER_WIDTH = 10

export interface NailConfig {
  axisX          : boolean   // If you wish to support panning in horizontal axis
  axisY          : boolean   // If you wish to support panning in vertical axis
  threshold     ?: number    // default: THRESHOLD
  gutterWidth   ?: number    // default: GUTTER_WIDTH
  gutterLeft    ?: NailInterface
  gutterRight   ?: NailInterface
}

/*---------------------------------------------------------------------------------------------------
Any component that uses nail must implement this interface
Event object passed here is actual DOM event. You should not try to see the event type as it may be 
touch / pointer event. Also touchStart may actually be touchMove (after ascertaining the axis)

All events have
  axis: AXIS

The Move Event also has
  direction: DIRECTION
  deltaX
  deltaY

panEnd/gutterEnd event also has:
  speed
----------------------------------------------------------------------------------------------------*/

// Reported back along with change (delta) in panning event
export enum DIRECTION {
  UP    = 1, // absolute direction wrt touch start, would mean that we are deltaY is negative
  RIGHT = 2, // absolute direction wrt touch start, would mean that we are deltaY is positive
  DOWN  = 3, // absolute direction wrt touch start, would mean that we are deltaY is positive
  LEFT  = 4  // absolute direction wrt touch start, would mean that we are deltaY is positive
}

// Reported along with the event
export enum AXIS {
  X     = 1,
  Y     = 2
}

export interface NailInterface {

  // Rarely used callback to know when touchStart begins, this is different from panStart
  // as onPanStart is fired when the movement has been ascertained
  onTouchStart?(event: any): void

  // This event is sent when touch start is ascertained based on threshold values
  onPanStart?(event: any): void

  // Notification on pan move. Return false if you did not use the event,
  // this helps in passing the event further down in system to other components and 
  // may help in scrolling etc.
  onPanMove(event: any): boolean

  // This event is sent when touch end or touch cancel happens for an started event
  onPanEnd(event: any): void

  // Used along with onTouchStart, either onTouchEnd or onPanEnd will be called
  onTouchEnd?(event: any): void

  // This function is just a convenience function for doing css work in requestAnimationFrame
  // On onPanStart and onPanMove can call nail.requestAnimation, which results into a callback
  // to this. Please note this is called only when a valid touchSession exists (already ascertained)
  onPanAnimate?(...animateParam: any[]): void
}

