import { pgTable, text, integer, boolean, timestamp, serial, jsonb, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Task categories
export const taskCategories = pgTable("task_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  color: varchar("color", { length: 50 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Task templates (repeatable patterns)
export const taskTemplates = pgTable("task_templates", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => taskCategories.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),

  // Time-based vs count-based
  type: varchar("type", { length: 20 }).notNull(), // "timed" | "count" | "boolean"
  targetDuration: integer("target_duration"), // minutes for timed tasks
  targetCount: integer("target_count"), // for count-based tasks

  // Recurrence
  frequency: varchar("frequency", { length: 20 }).notNull(), // "daily" | "weekly" | "monthly" | "yearly"
  daysOfWeek: jsonb("days_of_week").$type<number[]>(), // [0-6] for weekly tasks

  // Flexibility
  allowDebt: boolean("allow_debt").default(true), // can make up missed days
  rolloverDebt: boolean("rollover_debt").default(true), // debt carries to next period

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Actual task instances (generated from templates or one-offs)
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => taskTemplates.id),
  categoryId: integer("category_id").references(() => taskCategories.id).notNull(),

  title: text("title").notNull(),
  description: text("description"),
  notes: text("notes"),

  // Scheduling
  dueDate: timestamp("due_date"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  // Completion tracking
  status: varchar("status", { length: 20 }).default("pending"), // "pending" | "in-progress" | "completed" | "skipped" | "cancelled"
  completedAt: timestamp("completed_at"),

  // Time tracking
  type: varchar("type", { length: 20 }).notNull(),
  targetDuration: integer("target_duration"),
  actualDuration: integer("actual_duration").default(0),
  targetCount: integer("target_count"),
  actualCount: integer("actual_count").default(0),

  // Debt/credit
  debtMinutes: integer("debt_minutes").default(0),
  creditMinutes: integer("credit_minutes").default(0),

  // Metadata
  tags: jsonb("tags").$type<string[]>().default([]),
  priority: integer("priority").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Time tracking sessions (for timer)
export const timeSessions = pgTable("time_sessions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),

  startedAt: timestamp("started_at").notNull(),
  stoppedAt: timestamp("stopped_at"),
  durationMinutes: integer("duration_minutes").default(0),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily plans (what you commit to doing each day)
export const dailyPlans = pgTable("daily_plans", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),

  order: integer("order").default(0),
  completed: boolean("completed").default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Yearly goals (big picture)
export const yearlyGoals = pgTable("yearly_goals", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  categoryId: integer("category_id").references(() => taskCategories.id),

  title: text("title").notNull(),
  description: text("description"),
  targetMetric: text("target_metric"), // "Complete 12 videos" | "Read 24 books"

  progress: integer("progress").default(0),
  target: integer("target"),

  status: varchar("status", { length: 20 }).default("active"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Monthly goals (breakdown of yearly)
export const monthlyGoals = pgTable("monthly_goals", {
  id: serial("id").primaryKey(),
  yearlyGoalId: integer("yearly_goal_id").references(() => yearlyGoals.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  categoryId: integer("category_id").references(() => taskCategories.id),

  title: text("title").notNull(),
  description: text("description"),

  progress: integer("progress").default(0),
  target: integer("target"),

  status: varchar("status", { length: 20 }).default("active"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const taskCategoriesRelations = relations(taskCategories, ({ many }) => ({
  templates: many(taskTemplates),
  tasks: many(tasks),
  yearlyGoals: many(yearlyGoals),
  monthlyGoals: many(monthlyGoals),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ one, many }) => ({
  category: one(taskCategories, {
    fields: [taskTemplates.categoryId],
    references: [taskCategories.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  template: one(taskTemplates, {
    fields: [tasks.templateId],
    references: [taskTemplates.id],
  }),
  category: one(taskCategories, {
    fields: [tasks.categoryId],
    references: [taskCategories.id],
  }),
  timeSessions: many(timeSessions),
  dailyPlans: many(dailyPlans),
}));

export const timeSessionsRelations = relations(timeSessions, ({ one }) => ({
  task: one(tasks, {
    fields: [timeSessions.taskId],
    references: [tasks.id],
  }),
}));

export const dailyPlansRelations = relations(dailyPlans, ({ one }) => ({
  task: one(tasks, {
    fields: [dailyPlans.taskId],
    references: [tasks.id],
  }),
}));

export const yearlyGoalsRelations = relations(yearlyGoals, ({ one, many }) => ({
  category: one(taskCategories, {
    fields: [yearlyGoals.categoryId],
    references: [taskCategories.id],
  }),
  monthlyGoals: many(monthlyGoals),
}));

export const monthlyGoalsRelations = relations(monthlyGoals, ({ one }) => ({
  yearlyGoal: one(yearlyGoals, {
    fields: [monthlyGoals.yearlyGoalId],
    references: [yearlyGoals.id],
  }),
  category: one(taskCategories, {
    fields: [monthlyGoals.categoryId],
    references: [taskCategories.id],
  }),
}));

// Export types
export type TaskCategory = typeof taskCategories.$inferSelect;
export type NewTaskCategory = typeof taskCategories.$inferInsert;

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type TimeSession = typeof timeSessions.$inferSelect;
export type NewTimeSession = typeof timeSessions.$inferInsert;

export type DailyPlan = typeof dailyPlans.$inferSelect;
export type NewDailyPlan = typeof dailyPlans.$inferInsert;

export type YearlyGoal = typeof yearlyGoals.$inferSelect;
export type NewYearlyGoal = typeof yearlyGoals.$inferInsert;

export type MonthlyGoal = typeof monthlyGoals.$inferSelect;
export type NewMonthlyGoal = typeof monthlyGoals.$inferInsert;
