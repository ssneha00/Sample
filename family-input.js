const FAMILY_INPUT_SAMPLE = [
  {
    personAId: "P001",
    personAName: "Raghunath Sharma",
    personAFamily: "Sharma",
    personBId: "P002",
    personBName: "Shanti Sharma",
    personBFamily: "Sharma",
    relationship: "spouse"
  },
  {
    personAId: "P001",
    personAName: "Raghunath Sharma",
    personAFamily: "Sharma",
    personBId: "P003",
    personBName: "Mohan Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P002",
    personAName: "Shanti Sharma",
    personAFamily: "Sharma",
    personBId: "P003",
    personBName: "Mohan Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P001",
    personAName: "Raghunath Sharma",
    personAFamily: "Sharma",
    personBId: "P004",
    personBName: "Suresh Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P002",
    personAName: "Shanti Sharma",
    personAFamily: "Sharma",
    personBId: "P004",
    personBName: "Suresh Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P003",
    personAName: "Mohan Sharma",
    personAFamily: "Sharma",
    personBId: "P005",
    personBName: "Lakshmi Iyer",
    personBFamily: "Iyer",
    relationship: "spouse"
  },
  {
    personAId: "P004",
    personAName: "Suresh Sharma",
    personAFamily: "Sharma",
    personBId: "P006",
    personBName: "Nandini Reddy",
    personBFamily: "Reddy",
    relationship: "spouse"
  },
  {
    personAId: "P003",
    personAName: "Mohan Sharma",
    personAFamily: "Sharma",
    personBId: "P007",
    personBName: "Riya Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P005",
    personAName: "Lakshmi Iyer",
    personAFamily: "Iyer",
    personBId: "P007",
    personBName: "Riya Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P003",
    personAName: "Mohan Sharma",
    personAFamily: "Sharma",
    personBId: "P008",
    personBName: "Karan Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P005",
    personAName: "Lakshmi Iyer",
    personAFamily: "Iyer",
    personBId: "P008",
    personBName: "Karan Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P004",
    personAName: "Suresh Sharma",
    personAFamily: "Sharma",
    personBId: "P009",
    personBName: "Ananya Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P006",
    personAName: "Nandini Reddy",
    personAFamily: "Reddy",
    personBId: "P009",
    personBName: "Ananya Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P007",
    personAName: "Riya Sharma",
    personAFamily: "Sharma",
    personBId: "P010",
    personBName: "Arjun Kapoor",
    personBFamily: "Kapoor",
    relationship: "spouse"
  },
  {
    personAId: "P007",
    personAName: "Riya Sharma",
    personAFamily: "Sharma",
    personBId: "P011",
    personBName: "Anaya Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P010",
    personAName: "Arjun Kapoor",
    personAFamily: "Kapoor",
    personBId: "P011",
    personBName: "Anaya Sharma",
    personBFamily: "Sharma",
    relationship: "parent"
  },
  {
    personAId: "P005",
    personAName: "Lakshmi Iyer",
    personAFamily: "Iyer",
    personBId: "P012",
    personBName: "S. Iyer",
    personBFamily: "Iyer",
    relationship: "sibling"
  },
  {
    personAId: "P010",
    personAName: "Arjun Kapoor",
    personAFamily: "Kapoor",
    personBId: "P013",
    personBName: "Vikram Kapoor",
    personBFamily: "Kapoor",
    relationship: "sibling"
  }
];

const FAMILY_INPUT_TEMPLATE = JSON.stringify(FAMILY_INPUT_SAMPLE, null, 2);
