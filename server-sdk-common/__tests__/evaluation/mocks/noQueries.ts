import { BigSegmentStoreMembership } from '../../../src/api/interfaces';
import { Flag } from '../../../src/evaluation/data/Flag';
import { Segment } from '../../../src/evaluation/data/Segment';
import { Queries } from '../../../src/evaluation/Queries';

const noQueries: Queries = {
  getFlag(): Promise<Flag | undefined> {
    throw new Error('Function not implemented.');
  },
  getSegment(): Promise<Segment | undefined> {
    throw new Error('Function not implemented.');
  },
  getBigSegmentsMembership(): Promise<BigSegmentStoreMembership | undefined> {
    throw new Error('Function not implemented.');
  },
};

export default noQueries;
