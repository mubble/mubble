import { trigger, animate, 
         style, query,
         stagger, transition 
       }                                    from '@angular/animations'

export namespace BottomFlyIn {

  export const ANIM_DURATION    = '.4s',
               STAGGER_DURATION = 50,
               ANIMATION_STYLE  = 'ease-out',
               FLY_STATE        = 'fly',
               DONT_FLY_STATE   = 'dontFly'

  export const bottomFlyIn = trigger('bottomFlyIn', [
    transition(`* => ${FLY_STATE}`, [
      query('.flex-box-child', [
        style({
          transform: 'translate3d(0, 200%, 0)',
          opacity : 0}),
        stagger(STAGGER_DURATION, [
          animate(`${ANIM_DURATION} ${ANIMATION_STYLE}`, style({
            transform: 'translate3d(0, 0, 0)',
            opacity: 1
          }))
        ])
      ], {optional: true})
    ])
  ])

}