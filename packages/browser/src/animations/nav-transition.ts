import { trigger, state, 
         animate, style, 
         group, query,
         transition }                     from '@angular/animations'

export namespace NavTransition {

  export const ANIM_DURATION            = 400,
               PAGE_TRANSITION_DURATION = ANIM_DURATION + 'ms',
               IDLE                     = 'idle',
               FORWARD                  = 'forward',
               BACKWARD                 = 'backward',
               ANIMATION_STYLE          = 'ease-out'

  export const pageTransition = trigger('pageTransition', [
    transition(`${IDLE} => ${FORWARD}`, [
      
      query(':enter, :leave',
        style({ position: 'fixed', width:'100%' }),
        { optional: true }),
      
      group([
      
        query(':leave', [
          style({ transform: 'translate3d(0, 0, 0)', zIndex: 0})
        ], { optional: true }),

        query(':enter', [
          style({ transform: 'translate3d(100%, 0, 0)', zIndex: 100}),
          animate(`${PAGE_TRANSITION_DURATION} ${ANIMATION_STYLE}`, 
            style({ 
              transform: 'translate3d(0, 0, 0)',
              zIndex: 100
            }))
        ], { optional: true })

      ])
    ]),
    transition(`${IDLE} => ${BACKWARD}`, [
      
      query(':enter, :leave', style({ position: 'fixed', width:'100%' }),
        { optional: true }),
      
      group([
        
        query(':leave', [
          style({ transform: 'translate3d(0, 0, 0)', zIndex: 100}),
          animate(`${PAGE_TRANSITION_DURATION} ${ANIMATION_STYLE}`,
            style({ 
              transform: 'translate3d(100%, 0, 0)', 
              zIndex: 100
            }))
        ], { optional: true }),

        query(':enter', [
          style({ transform: 'translate3d(0, 0, 0)', zIndex: 0})
        ], { optional: true })
      ])
    ])
  ])

}