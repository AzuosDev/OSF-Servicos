import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Goal, GoalSchema } from './schemas/goal.schema';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Goal.name, schema: GoalSchema }])],
  providers: [GoalsService],
  controllers: [GoalsController],
})
export class GoalsModule {}
