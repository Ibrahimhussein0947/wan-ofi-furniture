import { forwardRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select } from './ui/Field';
import { branchesApi } from '../api/endpoints';

export const useBranches = (enabled = true) =>
  useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list(), staleTime: 5 * 60 * 1000, enabled });

/** Branch dropdown; hidden entirely when the business has only one location. */
const BranchSelect = forwardRef(function BranchSelect({ label = 'Branch', placeholder = 'All branches', hideIfSingle = true, ...props }, ref) {
  const { data = [] } = useBranches();
  if (hideIfSingle && data.length < 2) return null;
  return <Select ref={ref} label={label} placeholder={placeholder} options={data.map((b) => ({ value: b._id, label: `${b.name} (${b.code})` }))} {...props} />;
});

export default BranchSelect;
