import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ResForm from './ResForm.jsx';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

describe('ResForm', () => {
  it('renders the Andi title', () => {
    render(<ResForm />);
    expect(screen.getByText('Andi')).toBeTruthy();
  });

  it('renders the reservation form', () => {
    render(<ResForm />);
    expect(screen.getByText('Reservá tu mesa')).toBeTruthy();
    expect(screen.getByText('Reservar mesa')).toBeTruthy();
  });

  it('renders service selector', () => {
    render(<ResForm />);
    expect(screen.getAllByText('Mediodía').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cena').length).toBeGreaterThan(0);
  });

  it('renders all form fields', () => {
    render(<ResForm />);
    expect(screen.getByPlaceholderText('Tu nombre')).toBeTruthy();
    expect(screen.getByPlaceholderText('+54 9 11 ...')).toBeTruthy();
    expect(screen.getByPlaceholderText('Alergias, pedidos especiales...')).toBeTruthy();
  });

  it('has party size selector with default 2', () => {
    render(<ResForm />);
    const select = screen.getByDisplayValue('2 personas');
    expect(select).toBeTruthy();
  });

  it('has a time input', () => {
    render(<ResForm />);
    const timeInput = screen.getByDisplayValue(/\d{2}:\d{2}/);
    expect(timeInput).toBeTruthy();
  });
});
