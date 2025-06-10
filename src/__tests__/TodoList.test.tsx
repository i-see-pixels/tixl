import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import TodoList from '../app/components/TodoList';

describe('TodoList', () => {
  it('should render', () => {
    expect(render(<TodoList />)).toBeTruthy();
  });
});
