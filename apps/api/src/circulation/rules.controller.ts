import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { SettingsService } from './settings.service.js';

/** The circulation rules are public: the home page, the about page and the borrow bag quote them. */
@Controller('rules')
@Public()
export class RulesController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }
}
