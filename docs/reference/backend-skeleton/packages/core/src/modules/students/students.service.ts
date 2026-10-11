import { Student, studentsContract, type ChangeSection } from '@school/contracts';
import { assertCan, audit, createCrudService, rule, type Ctx } from '../../kernel';
import { studentsDb } from './students.db-service';

/** Hard cap used until the academics module supplies each section's own capacity. */
const SECTION_CAPACITY = 40;

const crud = createCrudService({
  contract: studentsContract,
  db: studentsDb,
  rules: {
    async beforeCreate(ctx, input) {
      if (await studentsDb.findByAdmissionNo(ctx, input.admissionNo)) {
        throw rule(`Admission number ${input.admissionNo} is already in use`);
      }
    },
    beforeRemove(_ctx, student) {
      if (student.status === 'active') throw rule('Withdraw the student before deleting the record');
    },
  },
});

/**
 * Everything the app can do with students. Routes, the offline sync upload, background jobs
 * and AI tools all call these same functions, so the rules are enforced once.
 */
export const studentsService = {
  ...crud,

  /** A custom action: several checks and two writes that must succeed or fail together. */
  async changeSection(ctx: Ctx, id: string, input: ChangeSection): Promise<Student> {
    assertCan(ctx, 'students', 'update');

    const student = await studentsDb.get(ctx, id);
    if (student.status !== 'active') throw rule('Only an active student can change section');
    if ((await studentsDb.countActiveInSection(ctx, input.sectionId)) >= SECTION_CAPACITY) {
      throw rule('That section is full');
    }

    const row = await studentsDb.update(ctx, id, { sectionId: input.sectionId }, input.version);
    await audit(ctx, 'students', 'change-section', id, { before: student, after: row });
    return Student.parse(row);
  },
};
