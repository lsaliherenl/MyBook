import { Injectable } from '@nestjs/common';

/** Source of "now" for circulation rules, so tests can move time forward. */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
