import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '@school/api-client';
import { studentsContract, type ChangeSection } from '@school/contracts';
import { createCrudHooks } from '../kernel/crud-hooks';

const crud = createCrudHooks(studentsContract, studentsApi);

export const studentKeys = crud.keys;
export const studentQueries = crud.queries;
export const useStudents = crud.useList;
export const useStudent = crud.useDetail;
export const useCreateStudent = crud.useCreate;
export const useUpdateStudent = crud.useUpdate;
export const useDeleteStudent = crud.useRemove;

/** A hook for a custom action follows the same pattern as the generated ones. */
export function useChangeSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ChangeSection & { id: string }) => studentsApi.changeSection(id, input),
    onSuccess: (student) => {
      queryClient.setQueryData(studentKeys.detail(student.id), student);
      return queryClient.invalidateQueries({ queryKey: studentKeys.lists() });
    },
  });
}
