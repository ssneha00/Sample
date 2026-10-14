const FAMILY_DATA_SAMPLE = {
  people: [
    { id: 'P001', name: 'Raghunath Sharma', family: 'Sharma', role: 'patriarch' },
    { id: 'P002', name: 'Shanti Sharma', family: 'Sharma' },
    { id: 'P003', name: 'Mohan Sharma', family: 'Sharma', role: 'family-head' },
    { id: 'P004', name: 'Suresh Sharma', family: 'Sharma', role: 'family-head' },
    { id: 'P005', name: 'Lakshmi Iyer', family: 'Iyer' },
    { id: 'P006', name: 'Nandini Reddy', family: 'Reddy' },
    { id: 'P007', name: 'Riya Sharma', family: 'Sharma' },
    { id: 'P008', name: 'Karan Sharma', family: 'Sharma' },
    { id: 'P009', name: 'Ananya Sharma', family: 'Sharma' },
    { id: 'P010', name: 'Arjun Kapoor', family: 'Kapoor' },
    { id: 'P011', name: 'Anaya Sharma', family: 'Sharma' },
    { id: 'P012', name: 'S. Iyer', family: 'Iyer' },
    { id: 'P013', name: 'Vikram Kapoor', family: 'Kapoor' }
  ],
  relations: [
    { source: 'P001', target: 'P002', kind: 'Spouse' },
    { source: 'P001', target: 'P003', kind: 'Parent' },
    { source: 'P002', target: 'P003', kind: 'Parent' },
    { source: 'P001', target: 'P004', kind: 'Parent' },
    { source: 'P002', target: 'P004', kind: 'Parent' },
    { source: 'P003', target: 'P005', kind: 'Spouse' },
    { source: 'P004', target: 'P006', kind: 'Spouse' },
    { source: 'P003', target: 'P007', kind: 'Parent' },
    { source: 'P005', target: 'P007', kind: 'Parent' },
    { source: 'P003', target: 'P008', kind: 'Parent' },
    { source: 'P005', target: 'P008', kind: 'Parent' },
    { source: 'P004', target: 'P009', kind: 'Parent' },
    { source: 'P006', target: 'P009', kind: 'Parent' },
    { source: 'P007', target: 'P010', kind: 'Spouse' },
    { source: 'P007', target: 'P011', kind: 'Parent' },
    { source: 'P010', target: 'P011', kind: 'Parent' },
    { source: 'P005', target: 'P012', kind: 'Sibling' },
    { source: 'P010', target: 'P013', kind: 'Sibling' }
  ]
};

const FAMILY_DATA_TEMPLATE = JSON.stringify(FAMILY_DATA_SAMPLE, null, 2);
