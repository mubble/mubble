import {DataMasker} from './data-masker'

describe('DataMasker',()=>{
  it('maskData works', ()=>{
    const maskedData = DataMasker.maskData(
      {
        maskKey: 'key',
        maskWith: '*',
        startSkipCount: 2,
        endSkipCount: 2
      },
      'HelloWorld'
    )
    expect(maskedData).toBe("He******ld")
  })
  it('maskData with default params', ()=>{
    const maskedData = DataMasker.maskData(
      {
        maskKey: 'key'
      },
      'HelloWorld'
    )
    expect(maskedData).toBe("**********")
  })
  it('maskData with invalid skip params', ()=>{
    const maskedData = DataMasker.maskData(
      {
        maskKey: 'key',
        startSkipCount: 10,
        endSkipCount: 10
      },
      'HelloWorld'
    )
    expect(maskedData).not.toBe('HelloWorld')
  })
})