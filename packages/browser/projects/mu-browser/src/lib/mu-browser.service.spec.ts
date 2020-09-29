import { TestBed } from '@angular/core/testing';

import { MuBrowser } from './mu-browser.service';

describe('MuBrowserService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: MuBrowser = TestBed.get(MuBrowser);
    expect(service).toBeTruthy();
  });
});
